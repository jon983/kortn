# Kalooki Lobby UI + 5-Player Support (Phase 4) — Design Spec

**Date:** 2026-09-19
**Status:** Approved design, pre-implementation-plan
**Builds on:** engine (`lib/kalooki`), persistence (`lib/db`), server (`lib/server` + `app/api`) — all complete.

## 1. Overview

Phase 4 delivers the **lobby** — the first player-facing UI — plus two gameplay-scope extensions surfaced during design: **up to 5 players** and **randomised seating**. It gives kortn a home: sign in, see your games/record, create a table (2–5 seats), share a code, watch chairs fill live, and deal. The visual identity established here — a **faded 1960s Eastern-European Jewish parlour** — carries into the table UI (Phase 5).

The **game table UI itself is NOT in this phase** (that's Phase 5). Phase 4 ends at "host deals" → the match becomes `active`; rendering the play surface is next.

### Scope
- IN: visual identity + reusable "room" UI kit; auth pages (Clerk); home screen; create-table; waiting room with live fill; **5-player support** (engine tests + server); **randomised seating at deal**; adaptive table-shape component (square 2–4 / pentagon 5); art-plate integration seam.
- OUT (later): the table/play UI (Phase 5); E2E + launch hardening (Phase 6).

## 2. Gameplay extensions (small, land in this phase)

### 2a. Up to 5 players (2–5)
The engine is entirely seat-count-driven — **no 2–4 cap exists** in code (verified). The 106-card deck supports 5 comfortably (5×13 = 65 dealt, 40-card stock). Changes:
- **Engine:** no logic change. **Add deal tests** proving 5-player `startMatch`/`dealRound` deals 13 each with no card loss/duplication and correct stock (40).
- **Server/lobby:** `createLobby` accepts `seats` in **2..5** (reject outside). No schema change (`seats` is an int).
- Max is **5** (not 6): 6 would leave a thin 27-card stock and no clean one-per-side shape.

### 2b. Randomised seating / turn order
Seats must not simply follow join order. At **deal time** (`startGame`), the server shuffles the player→seat assignment using the seeded RNG, then deals. Implementation: in `startGame`, after seats are filled, compute a random permutation of the joined users and reassign `match_players.seat_index` accordingly (persist), *before* `engineStartMatch`/`initGameState`. Turn order (eldest hand = left of dealer) then runs over the randomised arrangement. The dealer/first-player follows the engine's existing rule over the shuffled seats.

## 3. Visual identity — the "parlour" kit

A small set of reusable primitives so the lobby and (later) table share one look; the table UI inherits them.

- **Backdrop plates:** photographic AI-generated room images (see `docs/art-brief.md`), served from `public/art/` and overlaid with UI. A `<RoomBackdrop plate="room-home" />` component renders the plate with a warm vignette + subtle grain overlay and a graceful CSS fallback (the faded-parlour gradient) when a plate is missing. **Layout is backdrop-agnostic** — components position over whatever plate is set.
- **Palette/tokens:** bone plaster, sage wainscot, walnut, tarnished brass/gilt, faded maroon, muted blue — as CSS custom properties / Tailwind theme tokens.
- **Type:** a warm retro display face for logo/headings + a mid-century serif for body, via `next/font` (self-hosted, no external CDN).
- **Kit components:** `RoomBackdrop`, `Framed` (askew framed-notice panel), `PlaceCard` (seat card / code ticket), `Chair`/`Seat`, `TableShape` (see §5), `LampButton` (primary action). Each small, focused, unit-tested where it has logic.

## 4. Screens & flow

All screens are Next.js App Router routes wrapped in the parlour skin. Data actions call the **existing** server functions/routes from Phase 3 (`createLobby`, `joinLobby`, `startGame`) — Phase 4 adds thin server actions/route wiring where a page needs it, not new game logic.

- **Auth (Clerk):** sign-in / sign-up pages behind the "room seen from the doorway" plate. Unauthenticated users hitting protected routes are redirected to sign-in (middleware already wired).
- **Home `/`** — the living room: logo on the table; **Set the table** (create) and **Pull up a chair** (join by code); framed notices for **your active/resumable games** (deep-link into a match) and **your record** (games played, rounds won, bits net) read from the `users`/`match_players` aggregates.
- **Create `/create`** — choose **2–5 chairs**, see the 4-bit buy-in, "Deal us in" → calls `createLobby` → redirect to the waiting room with the join code.
- **Join** — enter a code (from home) → `joinLobby` → waiting room. Bad/closed/full code → clean inline error (Phase 3 routes already return 400 + reason).
- **Waiting room `/match/[id]/lobby`** — the **code ticket** to share; the **adaptive table** (square 2–4 / pentagon 5) with one seat per side/edge; filled seats show name, empty read "waiting…"; live **"N of M seated"**. Subscribes to the match's **SSE stream** for lobby updates (players joining). Host sees **Deal** (enabled only when full); everyone can **leave**. On deal, redirect to the table route (Phase 5 placeholder for now).

## 5. Adaptive table shape

A `TableShape` component renders the correct polygon for the seat count and places one seat centered on each **side/edge** (never on a corner/vertex):
- **2, 3, 4 → square** (4 sides). 2 = opposite sides; 3 = three sides; 4 = all four.
- **5 → pentagon** (point up; a seat centered on each of the 5 edges).
Seat slots are computed from the shape so the same component serves the waiting room now and the play table in Phase 5. Given `seats` and a `seatIndex→player` map, it returns positioned seat nodes. Pure geometry (edge-midpoint placement) is unit-tested.

## 6. Data & realtime

- **Reads:** home pulls the signed-in user's active matches (`listMatchesForUser`) and stats (`users` aggregates). Waiting room reads `getMatch` + `listPlayers`.
- **Realtime:** the waiting room opens the existing **SSE** stream (`/api/matches/[id]/stream`); Phase 3 already publishes a lobby ping on join and the full state on start. The client re-fetches the player list on a lobby ping and navigates to the table when a started state arrives.
- **Identity:** display names come from Clerk (already mirrored to `users` via `upsertUser`).

## 7. Testing

- **Engine:** 5-player deal tests (13 each, stock 40, no card loss) added to the engine suite.
- **Server:** `startGame` randomised-seating test — with a seeded RNG, seat assignment is a permutation of joined users (all seats covered, deterministic under the seed); `createLobby` rejects seats <2 or >5.
- **UI unit:** `TableShape` seat-position geometry (square 2/3/4, pentagon 5 — seats on edges); `RoomBackdrop` fallback when no plate; framed/place-card render.
- **UI integration (light, React Testing Library):** create flow calls `createLobby` and routes to the waiting room; waiting room renders seats from a player list and enables Deal only when full; join error surfaces the 400 reason.
- **E2E:** deferred to Phase 6.

## 8. Art assets
Per `docs/art-brief.md`: user-supplied photographic plates in `public/art/` (home room, table surface, 2 card backs, optional waiting/sign-in). Until they land, the CSS parlour fallback stands in. Fallback generation via AI Gateway free-tier image models is available if needed.

## 9. Future work (out of Phase 4)
- Table / play UI (Phase 5). E2E + launch hardening incl. Clerk production keys + kortn.com DNS (Phase 6). Turn timer (post-launch).
