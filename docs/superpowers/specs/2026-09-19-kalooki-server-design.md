# Kalooki Server / Realtime Runtime (Phase 3) — Design Spec

**Date:** 2026-09-19
**Status:** Approved design, pre-implementation-plan
**Builds on:** the engine (`lib/kalooki`, Phase 1) and persistence layer (`lib/db`, Phase 2), both complete and deployed.

## 1. Overview

Phase 3 is the **headless, authoritative game server** for Kalooki: a Next.js App Router app whose game logic lives in a framework-agnostic, dependency-injected **runtime service**. It exposes the authoritative action loop, real-time state fan-out to players, and the full match lifecycle (create → join → start → play → round/match transitions). No lobby or table UI is built in this phase — the deliverable is a complete, integration-tested game server drivable from scripts/`curl`.

**Transport decision:** real-time fan-out uses **Redis pub/sub as a cross-instance bus + Server-Sent Events (SSE) to browsers**. Clients POST actions (client→server) and receive state via an SSE stream (server→client). Turn-based play does not need bidirectional WebSockets. Ably/Pusher are not on the Vercel Marketplace; Redis is Marketplace-native, so this keeps everything on-platform (Vercel + Neon + Redis + Clerk) with auto-provisioned env vars.

### Scope
- IN: Next.js scaffold; Clerk auth wiring; match-lifecycle server functions; the authoritative `submitAction` loop; round/match transitions; Redis+SSE fan-out; per-seat redaction; integration tests.
- OUT (later phases): lobby UI (Phase 4), table UI (Phase 5), E2E + launch hardening incl. Clerk production keys/DNS (Phase 6), turn timer (post-launch).

## 2. Architecture

Three layers, mirroring the DI discipline of the engine/persistence:

1. **Runtime service (`lib/server/`)** — framework-agnostic, no HTTP. Takes dependencies (`db`, `pubsub`, `rng`) as parameters. Holds the authoritative loop, match lifecycle, round transitions, redaction, and the pub/sub abstraction. This is where correctness lives and is integration-tested with PGlite + an in-memory pub/sub.
2. **Route handlers (`app/api/**`)** — thin. Authenticate via Clerk, resolve the caller's seat, delegate to the runtime, shape HTTP responses. The SSE route bridges pub/sub → the client stream.
3. **Client (later phases)** — POSTs actions, holds an `EventSource` for state. Not built here.

## 3. The authoritative loop

`submitAction(deps, { matchId, userId, action }) → { ok: true } | { ok: false, reason }`

1. `resolveSeat(db, matchId, userId)` → seat index; reject if the user is not a player.
2. `loadGameState(db, matchId)` → `{ state, version }`; reject if no active game state.
3. Turn/phase legality is enforced by the pure engine, not re-implemented here.
4. `applyAction(state, seat, action, rng)` (pure engine).
5. Engine rejection → return `{ ok: false, reason }` to the caller only; no save, no publish.
6. Engine success → `saveGameState(db, matchId, version, newState)` + `appendMove(db, {...})`.
   - On `OptimisticLockError` (rare — only the turn-holder acts): reload state once and re-run steps 4–6; if it conflicts again, return `{ ok: false, reason: 'conflict' }`.
7. If the action ended the round or match → run **round/match transition** (Section 6).
8. `pubsub.publish('match:' + matchId, newMatchState)` — a single publish of the FULL new `MatchState` (redaction is per-subscriber at the SSE edge).

`rng` is injected (seeded in tests; a real RNG in production) so the engine's determinism/replay guarantees hold.

## 4. Pub/sub + SSE + redaction

### 4a. Pub/sub abstraction (`lib/server/pubsub.ts`)
Interface:
```
interface PubSub {
  publish(channel: string, message: unknown): Promise<void>;
  subscribe(channel: string, handler: (message: unknown) => void): Promise<() => void>; // returns unsubscribe
}
```
- **Redis impl** (production): `publish` → `PUBLISH`; `subscribe` opens a Redis connection, `SUBSCRIBE`s to the channel, invokes handler per message, returns an unsubscribe that closes it.
- **In-memory impl** (tests): `Map<channel, Set<handler>>`. Enables full loop testing with no network.

The channel is always `match:<matchId>`. The published payload is the full `MatchState`.

### 4b. Redaction (`lib/server/redact.ts`)
Pure function `redactStateFor(state: MatchState, seat: number): ClientView`. It is the **security boundary** — a bug here leaks hidden cards, so it is exhaustively unit-tested.
- Acting seat's own hand: full cards.
- Other seats' hands: **counts only** (no card identifiers).
- Stock: count only.
- Discard pile: full (public).
- Table melds: full (public), ordered via the engine's `layoutMeld` discipline.
- Derived fields the UI needs: `currentTurn`, `phase`, per-seat `{ score, status, hasOpened, handCount }`, `pot`, `roundNumber`, and round/match result (`winnerSeat`, `goOutType`, match `finished`/`winnerSeat`) when applicable.

### 4c. SSE route (`app/api/matches/[id]/stream/route.ts`)
- Clerk-authenticate → `resolveSeat`.
- Return a `ReadableStream` with `Content-Type: text/event-stream`.
- On connect: immediately send `redactStateFor(currentState, seat)` from `loadGameState` (resume-after-disconnect: a reconnecting player is instantly caught up).
- `pubsub.subscribe('match:'+id, ...)`: on each published `MatchState`, write `redactStateFor(state, seat)` to this client's stream.
- On stream close: unsubscribe.

### 4d. Action route (`app/api/matches/[id]/actions/route.ts`)
- Clerk-authenticate → `submitAction(deps, { matchId, userId, action: body })`.
- Response is minimal `{ ok }` / `{ ok: false, reason }`; the resulting state reaches all players (including the actor) via their SSE streams.

## 5. Auth & match lifecycle

### 5a. Auth (Clerk)
- Clerk middleware on the Next app.
- Every action/SSE/lifecycle route resolves the caller with Clerk server-side `auth()` → `userId`.
- `resolveSeat(db, matchId, userId)` maps identity → seat; the server NEVER trusts a client-supplied seat.
- Identity mirrored into `users` via `upsertUser` — on a Clerk webhook or lazy upsert on first authenticated request.

### 5b. Lifecycle functions (`lib/server/matches.ts`, DI'd)
- `createMatch(deps, { userId, seats })` → `upsertUser`; `createMatch` (status `lobby`, generated join code); seat creator at seat 0.
- `joinMatch(deps, { userId, joinCode })` → validate open seat; `addPlayer` at next seat; publish lobby update.
- `startMatch(deps, { matchId, userId })` → creator-only; seats filled required; record 4-bit buy-in per player into pot; engine `startMatch` (deal); `initGameState` version 0; status → `active`; publish initial state.
- `submitAction(...)` → Section 3.

## 6. Round & match transitions

Inside `submitAction`, after the engine reports a go-out (round finished), in the engine's **documented order** (settle → bust → rebuy → award):
1. `settleRound` (losers add hand points, pay bits) → `recordRound` → `incrementUserStats` (gamesPlayed on match end, roundsWon for the round winner, bitsNet deltas).
2. `applyBusts` (score > 150 → `busted`).
3. **Rebuy window:** busted, not-yet-rebought seats have a pending decision, resolved via an explicit `rebuy` / `decline` action (server function exists this phase; UI prompt in Phase 5). Resolve before award.
4. If exactly one active seat remains → `matchWinner` / `awardPot`, status → `finished`, `setMatchWinner`. Otherwise **deal the next round** (`dealRound`, dealer rotates) and publish.

Rebuy stays explicit so no player is auto-charged 4 bits.

**Versioning note:** the single `game_states` row per match keeps a **monotonic `version`** across the whole match — dealing the next round `UPDATE`s that row via `saveGameState` (version + 1), rather than resetting to 0. `version` is only 0 once, at `initGameState` in `startGame`. A per-match monotonic version keeps the client's SSE-resume cache coherent (a strictly increasing counter it can compare) and avoids ambiguity from a version that resets mid-match.

## 7. Testing

All hermetic — PGlite + in-memory pub/sub, no network/browser.
- **Redaction (`redact.ts`) — exhaustive (security boundary):** own hand full; opponents' hands counts only; a test asserts seat 0's view contains ZERO card ids from other seats; stock count-only; discard/melds public; derived fields correct.
- **Runtime loop (`submitAction`):** legal action → saved, version bumped, move appended, exactly one publish of new state; illegal action → rejected, no save/publish; not-your-turn / not-a-player → rejected; optimistic-conflict → reload-and-retry succeeds (simulate by bumping version underneath), and a persistent conflict returns `conflict`.
- **Lifecycle:** create → join → start deals 13 each, pot = seats×4, status active, initial publish; a scripted round to a go-out triggers settle/record/stats and either deals next round or awards pot; rebuy re-enters at current-highest score.
- **Pub/sub ↔ SSE (in-memory):** a fake subscriber for seat 1 receives a view with seat 0's hand redacted after an action.
- **Route handlers (thin):** light tests that Clerk identity → `resolveSeat` → runtime wiring and response shapes are correct.
- **Real Redis:** one opt-in smoke test, skipped in CI unless `REDIS_URL` is set; in-memory pub/sub carries logic coverage.

## 8. Provisioning / config (operational)
- Provision **Redis** via the Vercel Marketplace (`vercel integration add redis`), producing `REDIS_URL` env vars.
- SSE routes run on the default Node runtime (Fluid Compute) — long-lived streaming is supported there; no `edge` runtime.
- Clerk stays on development keys this phase; production keys + DNS on kortn.com are Phase 6.

## 9. Future work (out of Phase 3)
- Lobby UI (Phase 4), table UI (Phase 5), E2E + launch hardening (Phase 6).
- Turn timer / auto-forfeit (post-launch).
- Abandoned-match cleanup job.
