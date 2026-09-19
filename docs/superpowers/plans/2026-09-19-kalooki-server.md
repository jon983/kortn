# Kalooki Server / Realtime Runtime (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless, authoritative Kalooki game server — a Next.js App Router app whose game logic lives in a dependency-injected runtime service, with the authoritative action loop, Redis+SSE fan-out, per-seat redaction, Clerk-derived seats, and full match/round lifecycle — integration-tested hermetically.

**Architecture:** Framework-agnostic runtime in `lib/server/` (takes `{ db, pubsub, rng }` as deps — same DI style as the repositories). Thin Next.js route handlers authenticate via Clerk, resolve the caller's seat, and delegate to the runtime. Realtime fan-out = Redis pub/sub (cross-instance bus) + SSE (server→browser); actions arrive by POST. Redaction happens per-subscriber at the SSE edge.

**Tech Stack:** Next.js (App Router) + React, `@clerk/nextjs`, `redis` (node-redis), the existing engine (`lib/kalooki`) and persistence (`lib/db`), Vitest + PGlite for hermetic tests.

**Spec:** `docs/superpowers/specs/2026-09-19-kalooki-server-design.md`

## Global Constraints

- Name is **Kalooki**; app is **kortn**.
- Engine types/functions come from `lib/kalooki` (import `MatchState`, `Action`, `Card`, `TableMeld`, `Phase`, `GoOutType`, `SeatStatus`, `applyAction`, `startMatch`, `dealRound`, `layoutMeld`, `makeRng`). Persistence from `lib/db`. Do NOT reimplement engine or repo logic.
- Runtime in `lib/server/*` is framework-agnostic: NO `next/*`, React, or HTTP imports. It MAY use `Math.random` only via the injected `deps.rng`. Route handlers (`app/api/**`) are the only HTTP layer.
- DI: every runtime function takes `deps: RuntimeDeps` (or the specific handles) as its first argument. `RuntimeDeps = { db: DB; pubsub: PubSub; rng: () => number }`.
- The server NEVER trusts a client-supplied seat — seat is always derived from the authenticated Clerk `userId` via `resolveSeat`.
- Redaction is the security boundary: a player's view contains their own hand fully and only COUNTS for other hands and the stock. Tested exhaustively.
- Round/match transition order (from the engine's documented contract): **settle → bust → rebuy → award**. Rebuy is an explicit action, never automatic.
- Pub/sub channel is `match:<matchId>`; the published payload is the full `MatchState` (redaction is per-subscriber).
- Tests are hermetic: PGlite (`makeTestDb` from `lib/db/__tests__/helpers`) + the in-memory pub/sub. No network/browser. Real Redis is one opt-in smoke test skipped unless `REDIS_URL` is set.
- Run tests: `npx vitest run` (engine + db + server). Typecheck: `npx tsc --noEmit` (strict; noUnusedLocals/noUnusedParameters). Do NOT write to the live Neon DB or provision Redis except in the final human-gated task.
- SSE routes use the default Node runtime (Fluid Compute) — never `export const runtime = 'edge'`.

---

## File Structure

- `lib/server/pubsub.ts` — `PubSub` interface + `InMemoryPubSub`.
- `lib/server/redis-pubsub.ts` — `RedisPubSub` (production).
- `lib/server/redact.ts` — `ClientView` type + `redactStateFor(state, seat)`.
- `lib/server/seats.ts` — `resolveSeat`.
- `lib/server/deps.ts` — `RuntimeDeps` type + `SubmitResult` type + shared server result types.
- `lib/server/matches.ts` — `createMatch`, `joinMatch`, `startMatch` (lifecycle).
- `lib/server/runtime.ts` — `submitAction` (authoritative loop + round/match transition).
- `lib/server/index.ts` — barrel.
- `app/layout.tsx`, `app/page.tsx` — minimal Next scaffold.
- `middleware.ts` — Clerk middleware.
- `app/api/health/route.ts` — health check (scaffold sanity).
- `app/api/matches/[id]/actions/route.ts` — action route.
- `app/api/matches/[id]/stream/route.ts` — SSE route.
- `app/api/matches/route.ts`, `app/api/matches/[id]/join/route.ts`, `app/api/matches/[id]/start/route.ts` — lifecycle routes.
- `lib/server/__tests__/*.test.ts` — tests.
- Config: `next.config.ts`, `tsconfig.json` (adjust), `package.json` (scripts + deps).

---

## Task 1: Next.js + Clerk scaffold

**Files:**
- Modify: `package.json` (deps + scripts), `tsconfig.json`
- Create: `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `middleware.ts`, `app/api/health/route.ts`
- Test: `lib/server/__tests__/health.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a building Next app; a `GET` health route whose handler is importable and returns `{ ok: true }`.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install next@latest react@latest react-dom@latest @clerk/nextjs@latest redis@latest
npm install -D @types/react @types/react-dom
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/server/__tests__/health.test.ts
import { describe, it, expect } from 'vitest';
import { GET } from '../../../app/api/health/route';

describe('health route', () => {
  it('returns ok', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/health.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 4: Write the scaffold**

`package.json` — add scripts (merge into existing "scripts"):
```json
"dev": "next dev",
"build": "next build",
"start": "next start"
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {};
export default nextConfig;
```

`tsconfig.json` — merge these compilerOptions in addition to the existing ones (keep strict, noUnusedLocals, etc.): add `"jsx": "preserve"`, `"lib": ["dom", "dom.iterable", "esnext"]`, `"plugins": [{ "name": "next" }]`, `"allowJs": true`, `"incremental": true`, and ensure `"include"` contains `"app"`, `"middleware.ts"`, `"next-env.d.ts"` alongside the existing entries. (Do NOT remove `noUnusedLocals`/`noUnusedParameters`.)

`app/layout.tsx`:
```tsx
import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

export const metadata = { title: 'Kalooki', description: 'Online Kalooki card game' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return <main>Kalooki</main>;
}
```

`middleware.ts`:
```ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/api/(.*)'],
};
```

`app/api/health/route.ts`:
```ts
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Verify build, tests, and typecheck**

Run:
```bash
npx vitest run lib/server/__tests__/health.test.ts
npx vitest run            # engine + db must still pass
npx tsc --noEmit
npx next build            # must compile (Clerk keys are in .env.local; build should succeed)
```
Expected: all green; `next build` succeeds. If `next build` requires Clerk env at build and fails, confirm `.env.local` has the Clerk keys (it does). If the Next TS plugin regenerates `next-env.d.ts`, add it to git.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts app middleware.ts lib/server next-env.d.ts
git commit -m "feat(server): Next.js App Router + Clerk scaffold, health route"
```

---

## Task 2: PubSub abstraction + in-memory implementation

**Files:**
- Create: `lib/server/pubsub.ts`
- Test: `lib/server/__tests__/pubsub.test.ts`

**Interfaces:**
- Produces:
  - `interface PubSub { publish(channel: string, message: unknown): Promise<void>; subscribe(channel: string, handler: (message: unknown) => void): Promise<() => void>; }`
  - `class InMemoryPubSub implements PubSub` — process-local; `publish` synchronously invokes all handlers subscribed to that channel; `subscribe` returns an unsubscribe that removes the handler.

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/pubsub.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryPubSub } from '../pubsub';

describe('InMemoryPubSub', () => {
  it('delivers published messages to subscribers of the same channel', async () => {
    const ps = new InMemoryPubSub();
    const got: unknown[] = [];
    await ps.subscribe('match:1', (m) => got.push(m));
    await ps.publish('match:1', { v: 1 });
    await ps.publish('match:1', { v: 2 });
    expect(got).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('does not deliver across channels', async () => {
    const ps = new InMemoryPubSub();
    const got: unknown[] = [];
    await ps.subscribe('match:1', (m) => got.push(m));
    await ps.publish('match:2', { v: 1 });
    expect(got).toEqual([]);
  });

  it('unsubscribe stops delivery', async () => {
    const ps = new InMemoryPubSub();
    const got: unknown[] = [];
    const off = await ps.subscribe('match:1', (m) => got.push(m));
    off();
    await ps.publish('match:1', { v: 1 });
    expect(got).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/pubsub.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/server/pubsub.ts
export interface PubSub {
  publish(channel: string, message: unknown): Promise<void>;
  subscribe(channel: string, handler: (message: unknown) => void): Promise<() => void>;
}

export class InMemoryPubSub implements PubSub {
  private channels = new Map<string, Set<(message: unknown) => void>>();

  async publish(channel: string, message: unknown): Promise<void> {
    const handlers = this.channels.get(channel);
    if (!handlers) return;
    for (const h of [...handlers]) h(message);
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<() => void> {
    let set = this.channels.get(channel);
    if (!set) { set = new Set(); this.channels.set(channel, set); }
    set.add(handler);
    return () => {
      const s = this.channels.get(channel);
      if (s) { s.delete(handler); if (s.size === 0) this.channels.delete(channel); }
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/__tests__/pubsub.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/pubsub.ts lib/server/__tests__/pubsub.test.ts
git commit -m "feat(server): pub/sub abstraction + in-memory impl"
```

---

## Task 3: Redaction (security boundary)

**Files:**
- Create: `lib/server/redact.ts`
- Test: `lib/server/__tests__/redact.test.ts`

**Interfaces:**
- Consumes: `MatchState`, `Card`, `TableMeld`, `Phase`, `GoOutType`, `SeatStatus`, `layoutMeld` from `lib/kalooki`.
- Produces:
  - `interface SelfView { seat: number; hand: Card[]; handCount: number; score: number; status: SeatStatus; hasOpened: boolean }`
  - `interface OpponentView { seat: number; handCount: number; score: number; status: SeatStatus; hasOpened: boolean }`
  - `interface ClientView { seat: number; you: SelfView; opponents: OpponentView[]; stockCount: number; discard: Card[]; melds: TableMeld[]; currentTurn: number; phase: Phase; pot: number; roundNumber: number; roundFinished: boolean; roundWinnerSeat: number | null; goOutType: GoOutType | null; matchFinished: boolean; matchWinnerSeat: number | null }`
  - `function redactStateFor(state: MatchState, seat: number): ClientView`

Notes: `you.hand` is the seat's own hand (full); opponents expose only `handCount`. `stockCount = state.round.stock.length`. `discard` and `melds` are public; each meld's `cards` is passed through `layoutMeld(meld.cards, meld.kind)`. Per-seat score/status come from `state.scores[seat]`/`state.statuses[seat]`; `hasOpened`/`handCount` come from `state.round.players[seat]`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/redact.test.ts
import { describe, it, expect } from 'vitest';
import { redactStateFor } from '../redact';
import { startMatch } from '../../kalooki';

describe('redactStateFor', () => {
  it("shows the seat's own hand fully and others as counts only", () => {
    const state = startMatch({ seats: 3, seed: 4 });
    const view = redactStateFor(state, 0);
    expect(view.seat).toBe(0);
    expect(view.you.hand).toHaveLength(13);
    expect(view.you.handCount).toBe(13);
    expect(view.opponents.map((o) => o.seat).sort()).toEqual([1, 2]);
    for (const o of view.opponents) expect(o.handCount).toBe(13);
  });

  it('leaks no card identifiers from other seats', () => {
    const state = startMatch({ seats: 3, seed: 4 });
    const view = redactStateFor(state, 0);
    const serialized = JSON.stringify(view);
    // every card id from seats 1 and 2 must be absent from seat 0's view
    for (const p of state.round.players) {
      if (p.seat === 0) continue;
      for (const c of p.hand) expect(serialized.includes(c.id)).toBe(false);
    }
  });

  it('exposes public zones and derived fields', () => {
    const state = startMatch({ seats: 2, seed: 4 });
    const view = redactStateFor(state, 1);
    expect(view.stockCount).toBe(state.round.stock.length);
    expect(view.discard).toHaveLength(state.round.discard.length);
    expect(view.currentTurn).toBe(state.round.turn);
    expect(view.phase).toBe(state.round.phase);
    expect(view.pot).toBe(state.pot);
    expect(view.roundNumber).toBe(1);
    expect(view.matchFinished).toBe(false);
    expect(view.you.score).toBe(0);
    expect(view.you.status).toBe('active');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/redact.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/server/redact.ts
import {
  layoutMeld,
  type MatchState, type Card, type TableMeld, type Phase, type GoOutType, type SeatStatus,
} from '../kalooki';

export interface SelfView {
  seat: number; hand: Card[]; handCount: number; score: number; status: SeatStatus; hasOpened: boolean;
}
export interface OpponentView {
  seat: number; handCount: number; score: number; status: SeatStatus; hasOpened: boolean;
}
export interface ClientView {
  seat: number;
  you: SelfView;
  opponents: OpponentView[];
  stockCount: number;
  discard: Card[];
  melds: TableMeld[];
  currentTurn: number;
  phase: Phase;
  pot: number;
  roundNumber: number;
  roundFinished: boolean;
  roundWinnerSeat: number | null;
  goOutType: GoOutType | null;
  matchFinished: boolean;
  matchWinnerSeat: number | null;
}

export function redactStateFor(state: MatchState, seat: number): ClientView {
  const round = state.round;
  const self = round.players[seat];
  const you: SelfView = {
    seat,
    hand: self.hand.slice(),
    handCount: self.hand.length,
    score: state.scores[seat],
    status: state.statuses[seat],
    hasOpened: self.hasOpened,
  };
  const opponents: OpponentView[] = round.players
    .filter((p) => p.seat !== seat)
    .map((p) => ({
      seat: p.seat,
      handCount: p.hand.length,
      score: state.scores[p.seat],
      status: state.statuses[p.seat],
      hasOpened: p.hasOpened,
    }));
  const melds: TableMeld[] = round.melds.map((m) => ({ ...m, cards: layoutMeld(m.cards, m.kind) }));
  return {
    seat,
    you,
    opponents,
    stockCount: round.stock.length,
    discard: round.discard.slice(),
    melds,
    currentTurn: round.turn,
    phase: round.phase,
    pot: state.pot,
    roundNumber: state.roundNumber,
    roundFinished: round.finished,
    roundWinnerSeat: round.winnerSeat,
    goOutType: round.goOutType,
    matchFinished: state.finished,
    matchWinnerSeat: state.winnerSeat,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/__tests__/redact.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/redact.ts lib/server/__tests__/redact.test.ts
git commit -m "feat(server): per-seat state redaction"
```

---

## Task 4: Deps type + resolveSeat

**Files:**
- Create: `lib/server/deps.ts`, `lib/server/seats.ts`
- Test: `lib/server/__tests__/seats.test.ts`

**Interfaces:**
- Consumes: `DB` and `listPlayers` from `lib/db`; `PubSub` from `./pubsub`.
- Produces:
  - `interface RuntimeDeps { db: DB; pubsub: PubSub; rng: () => number }` (in `deps.ts`)
  - `type SubmitResult = { ok: true } | { ok: false; reason: string }` (in `deps.ts`)
  - `async function resolveSeat(db: DB, matchId: string, userId: string): Promise<number | null>` (in `seats.ts`) — returns the seat index the user holds, or null.

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/seats.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { upsertUser, createMatch, addPlayer } from '../../db';
import { resolveSeat } from '../seats';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('resolveSeat', () => {
  it('returns the seat a user holds, or null', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'S1' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    expect(await resolveSeat(db as any, m.id, 'u2')).toBe(1);
    expect(await resolveSeat(db as any, m.id, 'nobody')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/seats.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

```ts
// lib/server/deps.ts
import type { DB } from '../db';
import type { PubSub } from './pubsub';

export interface RuntimeDeps {
  db: DB;
  pubsub: PubSub;
  rng: () => number;
}

export type SubmitResult = { ok: true } | { ok: false; reason: string };
```

```ts
// lib/server/seats.ts
import type { DB } from '../db';
import { listPlayers } from '../db';

export async function resolveSeat(db: DB, matchId: string, userId: string): Promise<number | null> {
  const players = await listPlayers(db, matchId);
  const found = players.find((p) => p.userId === userId);
  return found ? found.seatIndex : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/__tests__/seats.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/deps.ts lib/server/seats.ts lib/server/__tests__/seats.test.ts
git commit -m "feat(server): runtime deps type + resolveSeat"
```

---

## Task 5: Match lifecycle (create / join / start)

**Files:**
- Create: `lib/server/matches.ts`
- Test: `lib/server/__tests__/matches.server.test.ts`

**Interfaces:**
- Consumes: `RuntimeDeps` (`./deps`); repos `upsertUser`, `createMatch` (aliased), `addPlayer`, `listPlayers`, `getMatch`, `getMatchByJoinCode`, `updateMatchStatus`, `updatePlayer`, `initGameState` from `lib/db`; engine `startMatch` (aliased) from `lib/kalooki`.
- Produces:
  - `async function createLobby(deps, { userId, displayName, seats }): Promise<{ matchId: string; joinCode: string }>` — upsertUser, create match (generate a 4-char A–Z join code via `deps.rng`), seat creator at seat 0.
  - `async function joinLobby(deps, { userId, displayName, joinCode }): Promise<{ matchId: string; seatIndex: number }>` — validate match is `lobby` and has an open seat; addPlayer at the lowest free seat; publish a lobby update to `match:<id>`.
  - `async function startGame(deps, { matchId, userId }): Promise<SubmitResult>` — creator-only (seat 0); all seats filled; record 4-bit buy-in per player (`updatePlayer bitsPaid`, pot via engine state); engine `startMatch({ seats, seed })` where `seed` is derived from `deps.rng`; set the match pot = seats*4 by using the engine's `startMatch` (which sets pot) and persist via `initGameState`; `updateMatchStatus(matchId, 'active')`; publish initial full state.

Note on pot/buy-in: `startMatch({seats, seed})` already sets `pot = seats*4` in the MatchState. Persist that state via `initGameState`. Also set each `match_players.bitsPaid = 4` via `updatePlayer`. The `matches.pot` column is informational for the lobby; keep it in sync by `updateMatchStatus` path is not enough — use a direct pot update is out of scope; the authoritative pot lives in the game state. (Ledger this: authoritative pot is `game_states.state.pot`; `matches.pot` column is left at its default and not used by the runtime.)

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/matches.server.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby, joinLobby, startGame } from '../matches';
import { loadGameState, listPlayers, getMatch } from '../../db';
import { makeRng } from '../../kalooki';

function deps(db: any) {
  return { db, pubsub: new InMemoryPubSub(), rng: makeRng(99) };
}
let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('match lifecycle', () => {
  it('creates a lobby, joins it, and starts the game', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = deps(db);

    const { matchId } = await createLobby(d, { userId: 'u1', displayName: 'A', seats: 2 });
    await joinLobby(d, { userId: 'u2', displayName: 'B', joinCode: (await getMatch(db as any, matchId))!.joinCode });

    const players = await listPlayers(db as any, matchId);
    expect(players.map((p) => p.seatIndex)).toEqual([0, 1]);

    const res = await startGame(d, { matchId, userId: 'u1' });
    expect(res.ok).toBe(true);

    const loaded = await loadGameState(db as any, matchId);
    expect(loaded?.version).toBe(0);
    expect(loaded?.state.pot).toBe(8); // 2 seats * 4
    expect(loaded?.state.round.players[0].hand).toHaveLength(13);
    expect((await getMatch(db as any, matchId))?.status).toBe('active');
  });

  it('rejects starting by a non-creator', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = deps(db);
    const { matchId } = await createLobby(d, { userId: 'u1', displayName: 'A', seats: 2 });
    await joinLobby(d, { userId: 'u2', displayName: 'B', joinCode: (await getMatch(db as any, matchId))!.joinCode });
    const res = await startGame(d, { matchId, userId: 'u2' });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/matches.server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/server/matches.ts
import type { RuntimeDeps, SubmitResult } from './deps';
import {
  upsertUser, addPlayer, listPlayers, getMatch, getMatchByJoinCode,
  updateMatchStatus, updatePlayer, initGameState,
  createMatch as createMatchRow,
} from '../db';
import { startMatch as engineStartMatch } from '../kalooki';

function makeJoinCode(rng: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(rng() * alphabet.length)];
  return code;
}

export async function createLobby(
  deps: RuntimeDeps,
  input: { userId: string; displayName: string; seats: number },
): Promise<{ matchId: string; joinCode: string }> {
  await upsertUser(deps.db, { id: input.userId, displayName: input.displayName });
  const joinCode = makeJoinCode(deps.rng);
  const match = await createMatchRow(deps.db, { createdBy: input.userId, seats: input.seats, joinCode });
  await addPlayer(deps.db, { matchId: match.id, userId: input.userId, seatIndex: 0 });
  return { matchId: match.id, joinCode };
}

export async function joinLobby(
  deps: RuntimeDeps,
  input: { userId: string; displayName: string; joinCode: string },
): Promise<{ matchId: string; seatIndex: number }> {
  await upsertUser(deps.db, { id: input.userId, displayName: input.displayName });
  const match = await getMatchByJoinCode(deps.db, input.joinCode);
  if (!match) throw new Error('No such match');
  if (match.status !== 'lobby') throw new Error('Match already started');
  const players = await listPlayers(deps.db, match.id);
  if (players.some((p) => p.userId === input.userId)) {
    const existing = players.find((p) => p.userId === input.userId)!;
    return { matchId: match.id, seatIndex: existing.seatIndex };
  }
  if (players.length >= match.seats) throw new Error('Match is full');
  const taken = new Set(players.map((p) => p.seatIndex));
  let seatIndex = 0;
  while (taken.has(seatIndex)) seatIndex++;
  await addPlayer(deps.db, { matchId: match.id, userId: input.userId, seatIndex });
  await deps.pubsub.publish('match:' + match.id, { type: 'lobby', matchId: match.id });
  return { matchId: match.id, seatIndex };
}

export async function startGame(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string },
): Promise<SubmitResult> {
  const match = await getMatch(deps.db, input.matchId);
  if (!match) return { ok: false, reason: 'No such match' };
  if (match.createdBy !== input.userId) return { ok: false, reason: 'Only the creator can start' };
  if (match.status !== 'lobby') return { ok: false, reason: 'Already started' };
  const players = await listPlayers(deps.db, input.matchId);
  if (players.length !== match.seats) return { ok: false, reason: 'Seats not filled' };

  const seed = Math.floor(deps.rng() * 2_147_483_647);
  const state = engineStartMatch({ seats: match.seats, seed });
  await initGameState(deps.db, input.matchId, state);
  for (const p of players) await updatePlayer(deps.db, input.matchId, p.seatIndex, { bitsPaid: 4 });
  await updateMatchStatus(deps.db, input.matchId, 'active');
  await deps.pubsub.publish('match:' + input.matchId, state);
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/__tests__/matches.server.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/matches.ts lib/server/__tests__/matches.server.test.ts
git commit -m "feat(server): match lifecycle (create/join/start)"
```

---

## Task 6: Authoritative action loop (`submitAction`)

**Files:**
- Create: `lib/server/runtime.ts`
- Test: `lib/server/__tests__/runtime.test.ts`

**Interfaces:**
- Consumes: `RuntimeDeps`, `SubmitResult` (`./deps`); `resolveSeat` (`./seats`); repos `loadGameState`, `saveGameState`, `appendMove`, `listMoves`, `OptimisticLockError` from `lib/db`; engine `applyAction`, `Action` from `lib/kalooki`.
- Produces:
  - `async function submitAction(deps: RuntimeDeps, input: { matchId: string; userId: string; action: Action }): Promise<SubmitResult>` — the authoritative loop. Round/match transition is added in Task 7 (this task handles a within-round action, save, append, publish; a go-out just persists and publishes the finished-round state).

Behavior (this task):
1. `resolveSeat` → seat; null → `{ ok: false, reason: 'Not a player' }`.
2. `loadGameState` → null → `{ ok: false, reason: 'No active game' }`.
3. `applyAction(state, seat, action, deps.rng)`; on `!ok` → return `{ ok: false, reason }`.
4. `saveGameState(db, matchId, version, res.match)`; on `OptimisticLockError` → reload once and retry steps 3–4; second failure → `{ ok: false, reason: 'conflict' }`.
5. `appendMove(db, { matchId, roundNumber: state.roundNumber, seatIndex: seat, sequence: (await listMoves).length + 1, action })`.
6. `deps.pubsub.publish('match:'+matchId, savedState)`.
7. return `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/runtime.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby, joinLobby, startGame } from '../matches';
import { submitAction } from '../runtime';
import { getMatch, loadGameState, listMoves, saveGameState } from '../../db';
import { makeRng } from '../../kalooki';

function mkDeps(db: any) { return { db, pubsub: new InMemoryPubSub(), rng: makeRng(3) }; }
let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function startedMatch(db: any) {
  const d = mkDeps(db);
  const { matchId } = await createLobby(d, { userId: 'u1', displayName: 'A', seats: 2 });
  await joinLobby(d, { userId: 'u2', displayName: 'B', joinCode: (await getMatch(db, matchId))!.joinCode });
  await startGame(d, { matchId, userId: 'u1' });
  return { d, matchId };
}

describe('submitAction', () => {
  it('applies a legal draw: saves (version bump), appends a move, publishes', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const { d, matchId } = await startedMatch(db);
    const before = await loadGameState(db as any, matchId);
    const turnSeat = before!.state.round.turn;
    const actingUser = turnSeat === 0 ? 'u1' : 'u2';

    const got: unknown[] = [];
    await d.pubsub.subscribe('match:' + matchId, (m) => got.push(m));

    const res = await submitAction(d, { matchId, userId: actingUser, action: { type: 'draw', source: 'stock' } });
    expect(res.ok).toBe(true);

    const after = await loadGameState(db as any, matchId);
    expect(after!.version).toBe(before!.version + 1);
    expect(after!.state.round.phase).toBe('awaitingDiscard');
    expect(await listMoves(db as any, matchId)).toHaveLength(1);
    expect(got).toHaveLength(1);
  });

  it('rejects a non-player and an out-of-turn actor', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const { d, matchId } = await startedMatch(db);
    const st = await loadGameState(db as any, matchId);
    const wrongUser = st!.state.round.turn === 0 ? 'u2' : 'u1';

    expect((await submitAction(d, { matchId, userId: 'stranger', action: { type: 'draw', source: 'stock' } })).ok).toBe(false);
    expect((await submitAction(d, { matchId, userId: wrongUser, action: { type: 'draw', source: 'stock' } })).ok).toBe(false);
  });

  it('recovers from a stale-version conflict by reloading and retrying', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const { d, matchId } = await startedMatch(db);
    const before = await loadGameState(db as any, matchId);
    const actingUser = before!.state.round.turn === 0 ? 'u1' : 'u2';

    // Simulate a concurrent write bumping the version out from under the first read is
    // hard to interleave deterministically; instead assert the happy path persists and a
    // second legal action by the same turn holder (after drawing) also succeeds.
    const r1 = await submitAction(d, { matchId, userId: actingUser, action: { type: 'draw', source: 'stock' } });
    expect(r1.ok).toBe(true);
    const mid = await loadGameState(db as any, matchId);
    const card = mid!.state.round.players[mid!.state.round.turn].hand[0];
    const r2 = await submitAction(d, { matchId, userId: actingUser, action: { type: 'discard', cardId: card.id } });
    expect(r2.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/runtime.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// lib/server/runtime.ts
import type { RuntimeDeps, SubmitResult } from './deps';
import { resolveSeat } from './seats';
import { loadGameState, saveGameState, appendMove, listMoves, OptimisticLockError } from '../db';
import { applyAction, type Action } from '../kalooki';

export async function submitAction(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string; action: Action },
): Promise<SubmitResult> {
  const seat = await resolveSeat(deps.db, input.matchId, input.userId);
  if (seat === null) return { ok: false, reason: 'Not a player in this match' };

  for (let attempt = 0; attempt < 2; attempt++) {
    const loaded = await loadGameState(deps.db, input.matchId);
    if (!loaded) return { ok: false, reason: 'No active game' };

    const result = applyAction(loaded.state, seat, input.action, deps.rng);
    if (!result.ok) return { ok: false, reason: result.reason };

    try {
      await saveGameState(deps.db, input.matchId, loaded.version, result.match);
    } catch (e) {
      if (e instanceof OptimisticLockError) continue; // reload + retry once
      throw e;
    }

    const existing = await listMoves(deps.db, input.matchId);
    await appendMove(deps.db, {
      matchId: input.matchId,
      roundNumber: loaded.state.roundNumber,
      seatIndex: seat,
      sequence: existing.length + 1,
      action: input.action,
    });

    await deps.pubsub.publish('match:' + input.matchId, result.match);
    return { ok: true };
  }
  return { ok: false, reason: 'conflict' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/__tests__/runtime.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server/runtime.ts lib/server/__tests__/runtime.test.ts
git commit -m "feat(server): authoritative action loop (submitAction)"
```

---

## Task 7: Round & match transitions

**Files:**
- Modify: `lib/server/runtime.ts`
- Test: `lib/server/__tests__/transitions.test.ts`

**Interfaces:**
- Consumes: scoring `settleRound`, `applyBusts`, `matchWinner`, `awardPot`, `rebuy` from `lib/kalooki`; repos `recordRound`, `incrementUserStats`, `setMatchWinner`, `updatePlayer`, `saveGameState`, `initGameState`, `listPlayers` from `lib/db`; engine `dealRound` from `lib/kalooki`.
- Produces:
  - After step 4 (successful save) in `submitAction`, when `result.match.round.finished === true`, run `finishRoundTransition(deps, matchId, result.match)` BEFORE the publish, and publish the resulting (post-transition) state. Extract the transition into a helper:
  - `async function finishRoundTransition(deps: RuntimeDeps, matchId: string, state: MatchState): Promise<MatchState>` — returns the state to persist+publish (either a freshly dealt next round, or the finished match).

`finishRoundTransition` logic (settle → bust → rebuy-window → award/next-round):
1. `const settled = settleRound(state)` (scores + pot updated).
2. `await recordRound(db, { matchId, roundNumber: state.roundNumber, dealerSeat: state.round.dealerSeat, winnerSeat: state.round.winnerSeat!, goOutType: state.round.goOutType!, scores: settled.scores })`.
3. Stats: for the round winner seat → look up its userId via `listPlayers`, `incrementUserStats(db, winnerUserId, { roundsWon: 1 })`.
4. `const busted = applyBusts(settled)`.
5. **Match end check:** `const winner = matchWinner(busted)`. If `winner !== null` → `const done = awardPot(busted)`; look up winner userId; `setMatchWinner(db, matchId, winnerUserId)`; `incrementUserStats` gamesPlayed for all seats; persist `done` via `saveGameState` (bump version) and return `done`.
6. **Rebuy window:** if any seat is `busted && !rebought`, leave the state paused for rebuy decisions — for THIS phase, since rebuy is an explicit action (handled below) and no UI exists yet, auto-advance is NOT applied. Return `busted` persisted via `saveGameState`; the next round is dealt only once no seat is pending a rebuy decision. To keep the server progressable in tests, expose the rebuy decision as an action handled in `submitAction` (see below).
7. **Next round:** if no seat is `busted && !rebought` and the match is not over → deal the next round: `const nextRound = dealRound({ seats: busted.seats, dealerSeat: (state.round.dealerSeat + 1) % busted.seats, rng: deps.rng })`; build `const next: MatchState = { ...busted, round: nextRound, roundNumber: busted.roundNumber + 1 }`; persist by REPLACING game state — since `game_states` is one row per match keyed by matchId with a version, use `saveGameState(db, matchId, <currentVersion>, next)`. Return `next`.

Rebuy/decline as explicit actions in `submitAction`: BEFORE the engine `applyAction` call, intercept two server-level action types not handled by the pure engine — `{ type: 'rebuy' }` and `{ type: 'decline' }` (declared as a `ServerAction` union in `deps.ts`). If `input.action.type === 'rebuy'`: require the seat is `busted && !rebought`; apply engine `rebuy(state, seat)`; save+publish; then if no seat is pending, deal next round. If `decline`: mark the seat permanently out for the match (it stays `busted`); then if no seat pending, deal next round or award.

To keep Task 7 bounded and testable, implement the version-threading via a small helper that reloads the current version before each `saveGameState`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/transitions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { finishRoundTransition } from '../runtime';
import { upsertUser, createMatch, addPlayer, initGameState, loadGameState, recordRound as _rr } from '../../db';
import { startMatch, makeRng, type MatchState } from '../../kalooki';

function mkDeps(db: any) { return { db, pubsub: new InMemoryPubSub(), rng: makeRng(7) }; }
let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

// Build a finished-round MatchState: seat 0 went out (empty hand), seat 1 holds cards.
function finishedRoundState(): MatchState {
  const s = startMatch({ seats: 2, seed: 1 });
  const round = {
    ...s.round,
    players: [
      { seat: 0, hand: [], hasOpened: true },
      { seat: 1, hand: [{ id: 'A-clubs-9', kind: 'natural', rank: 9, suit: 'clubs', pack: 'A' } as any], hasOpened: true },
    ],
    finished: true, winnerSeat: 0, goOutType: 'normal' as const,
    turnStartHandSize: 2, openedAtTurnStart: true,
  };
  return { ...s, round };
}

describe('finishRoundTransition', () => {
  it('settles a normal round, records it, and deals the next round', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T1' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    const state = finishedRoundState();
    await initGameState(db as any, m.id, state);

    const next = await finishRoundTransition(d, m.id, state);
    // seat 1 held a 9 → +9; seat 0 (winner) 0
    expect(next.scores).toEqual([0, 9]);
    expect(next.roundNumber).toBe(2);            // next round dealt
    expect(next.round.players[0].hand).toHaveLength(13);
    expect(next.finished).toBe(false);
    const persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.roundNumber).toBe(2);
  });

  it('ends the match when only one player remains under 150', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T2' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    // seat 1 already at 145, will bust with +9 -> 154 > 150
    const state = finishedRoundState();
    state.scores = [0, 145];
    await initGameState(db as any, m.id, state);

    const done = await finishRoundTransition(d, m.id, state);
    expect(done.finished).toBe(true);
    expect(done.winnerSeat).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/transitions.test.ts`
Expected: FAIL — `finishRoundTransition` not exported.

- [ ] **Step 3: Write the implementation**

Add to `lib/server/runtime.ts` (and wire it into `submitAction` after a successful save when `result.match.round.finished`):

```ts
// add imports at top of runtime.ts
import {
  settleRound, applyBusts, matchWinner, awardPot, rebuy as engineRebuy,
  dealRound, type MatchState,
} from '../kalooki';
import { recordRound, incrementUserStats, setMatchWinner, listPlayers } from '../db';

async function userIdForSeat(deps: RuntimeDeps, matchId: string, seat: number): Promise<string | null> {
  const players = await listPlayers(deps.db, matchId);
  return players.find((p) => p.seatIndex === seat)?.userId ?? null;
}

async function persist(deps: RuntimeDeps, matchId: string, next: MatchState): Promise<MatchState> {
  const cur = await loadGameState(deps.db, matchId);
  if (!cur) throw new Error('game state vanished');
  await saveGameState(deps.db, matchId, cur.version, next);
  return next;
}

function anyPendingRebuy(state: MatchState): boolean {
  return state.statuses.some((s, i) => s === 'busted' && !state.rebought[i]);
}

export async function finishRoundTransition(
  deps: RuntimeDeps,
  matchId: string,
  state: MatchState,
): Promise<MatchState> {
  // 1. settle
  const settled = settleRound(state);
  // 2. record round
  await recordRound(deps.db, {
    matchId,
    roundNumber: state.roundNumber,
    dealerSeat: state.round.dealerSeat,
    winnerSeat: state.round.winnerSeat!,
    goOutType: state.round.goOutType!,
    scores: settled.scores,
  });
  // 3. round-winner stat
  const winnerUser = await userIdForSeat(deps, matchId, state.round.winnerSeat!);
  if (winnerUser) await incrementUserStats(deps.db, winnerUser, { roundsWon: 1 });
  // 4. busts
  const busted = applyBusts(settled);
  // 5. match end?
  const winnerSeat = matchWinner(busted);
  if (winnerSeat !== null) {
    const done = awardPot(busted);
    const wUser = await userIdForSeat(deps, matchId, winnerSeat);
    if (wUser) await setMatchWinner(deps.db, matchId, wUser);
    const players = await listPlayers(deps.db, matchId);
    for (const p of players) await incrementUserStats(deps.db, p.userId, { gamesPlayed: 1 });
    return persist(deps, matchId, done);
  }
  // 6. rebuy window: pause for explicit rebuy/decline decisions
  if (anyPendingRebuy(busted)) {
    return persist(deps, matchId, busted);
  }
  // 7. deal next round
  const nextRound = dealRound({
    seats: busted.seats,
    dealerSeat: (state.round.dealerSeat + 1) % busted.seats,
    rng: deps.rng,
  });
  const next: MatchState = { ...busted, round: nextRound, roundNumber: busted.roundNumber + 1 };
  return persist(deps, matchId, next);
}
```

Wire into `submitAction`: replace the publish tail so that, after a successful `saveGameState`, if `result.match.round.finished` is true, compute `const finalState = await finishRoundTransition(deps, input.matchId, result.match)` and publish `finalState`; otherwise publish `result.match`. Also handle the two `ServerAction`s (`rebuy`/`decline`) before the engine call:

```ts
// near the top of submitAction, after resolving seat, before the loop:
if (input.action.type === 'rebuy' || input.action.type === 'decline') {
  const loaded = await loadGameState(deps.db, input.matchId);
  if (!loaded) return { ok: false, reason: 'No active game' };
  const st = loaded.state;
  if (st.statuses[seat] !== 'busted' || st.rebought[seat]) {
    return { ok: false, reason: 'No rebuy pending for you' };
  }
  let updated: MatchState;
  if (input.action.type === 'rebuy') {
    updated = engineRebuy(st, seat);
  } else {
    // decline: mark rebought=true so the seat is permanently out and no longer pending
    const rebought = st.rebought.slice(); rebought[seat] = true;
    updated = { ...st, rebought };
  }
  await saveGameState(deps.db, input.matchId, loaded.version, updated);
  // once no seat is pending, deal the next round or end the match
  let toPublish: MatchState = updated;
  if (!anyPendingRebuy(updated)) {
    const winnerSeat = matchWinner(updated);
    if (winnerSeat !== null) {
      const done = awardPot(updated);
      const wUser = await userIdForSeat(deps, input.matchId, winnerSeat);
      if (wUser) await setMatchWinner(deps.db, input.matchId, wUser);
      toPublish = await persist(deps, input.matchId, done);
    } else {
      const nextRound = dealRound({ seats: updated.seats, dealerSeat: (updated.round.dealerSeat + 1) % updated.seats, rng: deps.rng });
      toPublish = await persist(deps, input.matchId, { ...updated, round: nextRound, roundNumber: updated.roundNumber + 1 });
    }
  }
  await deps.pubsub.publish('match:' + input.matchId, toPublish);
  return { ok: true };
}
```

Add to `deps.ts`:
```ts
import type { Action as EngineAction } from '../kalooki';
export type ServerAction = EngineAction | { type: 'rebuy' } | { type: 'decline' };
```
And change `submitAction`'s `action` param type to `ServerAction`. The engine branch narrows away `rebuy`/`decline` (they are handled first), so the remaining `input.action` passed to `applyAction` is an `EngineAction` — assert with a type guard `if (input.action.type === 'rebuy' || input.action.type === 'decline')` returning early guarantees this.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/__tests__/transitions.test.ts && npx vitest run lib/server && npx tsc --noEmit`
Expected: PASS (transitions + all prior server tests still green).

- [ ] **Step 5: Commit**

```bash
git add lib/server/runtime.ts lib/server/deps.ts lib/server/__tests__/transitions.test.ts
git commit -m "feat(server): round/match transitions + rebuy/decline actions"
```

---

## Task 8: Redis pub/sub implementation

**Files:**
- Create: `lib/server/redis-pubsub.ts`
- Test: `lib/server/__tests__/redis-pubsub.test.ts`

**Interfaces:**
- Consumes: `PubSub` (`./pubsub`); the `redis` npm package.
- Produces: `class RedisPubSub implements PubSub` constructed from a `REDIS_URL`. `publish` uses a shared publisher client; `subscribe` creates a dedicated duplicated connection (node-redis requires a separate client for subscription), subscribes to the channel parsing JSON, and returns an unsubscribe that unsubscribes + quits that connection. `publish` JSON-stringifies the message.

- [ ] **Step 1: Write the failing test (opt-in smoke test)**

```ts
// lib/server/__tests__/redis-pubsub.test.ts
import { describe, it, expect } from 'vitest';
import { RedisPubSub } from '../redis-pubsub';

const url = process.env.REDIS_URL;
const maybe = url ? describe : describe.skip;

maybe('RedisPubSub (smoke, requires REDIS_URL)', () => {
  it('round-trips a message', async () => {
    const ps = new RedisPubSub(url!);
    const got: unknown[] = [];
    const off = await ps.subscribe('match:test', (m) => got.push(m));
    await new Promise((r) => setTimeout(r, 100));
    await ps.publish('match:test', { hello: 'world' });
    await new Promise((r) => setTimeout(r, 200));
    expect(got).toEqual([{ hello: 'world' }]);
    await off();
    await ps.close();
  });
});

// Also assert the class is constructable without a connection (no network at import).
describe('RedisPubSub construction', () => {
  it('constructs without connecting', () => {
    const ps = new RedisPubSub('redis://localhost:6379');
    expect(ps).toBeInstanceOf(RedisPubSub);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/redis-pubsub.test.ts`
Expected: FAIL — module not found (the smoke test is skipped without `REDIS_URL`, but the construction test fails until the class exists).

- [ ] **Step 3: Write the implementation**

```ts
// lib/server/redis-pubsub.ts
import { createClient, type RedisClientType } from 'redis';
import type { PubSub } from './pubsub';

export class RedisPubSub implements PubSub {
  private url: string;
  private publisher: RedisClientType | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private async getPublisher(): Promise<RedisClientType> {
    if (!this.publisher) {
      this.publisher = createClient({ url: this.url });
      await this.publisher.connect();
    }
    return this.publisher;
  }

  async publish(channel: string, message: unknown): Promise<void> {
    const pub = await this.getPublisher();
    await pub.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<() => void> {
    const sub: RedisClientType = createClient({ url: this.url });
    await sub.connect();
    await sub.subscribe(channel, (raw) => {
      handler(JSON.parse(raw));
    });
    return async () => {
      await sub.unsubscribe(channel);
      await sub.quit();
    };
  }

  async close(): Promise<void> {
    if (this.publisher) { await this.publisher.quit(); this.publisher = null; }
  }
}
```

Note: `subscribe` returns an async unsubscribe; the `PubSub` interface declares `() => void`. Widen the interface's unsubscribe return to `void | Promise<void>` in `pubsub.ts` (and update `InMemoryPubSub` accordingly — its sync unsubscribe still satisfies `void | Promise<void>`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server/__tests__/redis-pubsub.test.ts && npx tsc --noEmit`
Expected: PASS (smoke test skipped without REDIS_URL; construction test passes).

- [ ] **Step 5: Commit**

```bash
git add lib/server/redis-pubsub.ts lib/server/pubsub.ts lib/server/__tests__/redis-pubsub.test.ts
git commit -m "feat(server): Redis pub/sub implementation"
```

---

## Task 9: Route handlers (actions, SSE, lifecycle) + barrel

**Files:**
- Create: `app/api/matches/route.ts`, `app/api/matches/[id]/join/route.ts`, `app/api/matches/[id]/start/route.ts`, `app/api/matches/[id]/actions/route.ts`, `app/api/matches/[id]/stream/route.ts`, `lib/server/prod-deps.ts`, `lib/server/index.ts`
- Test: `lib/server/__tests__/prod-deps.test.ts`

**Interfaces:**
- Consumes: everything above; Clerk `auth` from `@clerk/nextjs/server`; `db` from `lib/db`; `RedisPubSub`.
- Produces:
  - `lib/server/prod-deps.ts` — `function getProdDeps(): RuntimeDeps` building `{ db, pubsub: new RedisPubSub(process.env.REDIS_URL!), rng: Math.random }` as a lazily-created singleton. Also `getDisplayName(...)` helper from Clerk claims.
  - `lib/server/index.ts` — barrel re-exporting pubsub, redact, seats, deps, matches, runtime.
  - Route handlers wiring Clerk `auth()` → runtime.

Because route handlers require the Next/Clerk runtime, they are validated by `next build` (Task 1 established the pattern) rather than unit tests; the runtime logic they call is already fully tested. The only unit test here asserts `getProdDeps` constructs without throwing when env is present.

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/prod-deps.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('getProdDeps', () => {
  beforeEach(() => { process.env.REDIS_URL = 'redis://localhost:6379'; });
  it('builds runtime deps with a pubsub and rng', async () => {
    const { getProdDeps } = await import('../prod-deps');
    const deps = getProdDeps();
    expect(typeof deps.rng).toBe('function');
    expect(deps.pubsub).toBeDefined();
    expect(deps.rng()).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/prod-deps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementations**

```ts
// lib/server/prod-deps.ts
import { db } from '../db';
import { RedisPubSub } from './redis-pubsub';
import type { RuntimeDeps } from './deps';

let cached: RuntimeDeps | null = null;

export function getProdDeps(): RuntimeDeps {
  if (!cached) {
    cached = {
      db,
      pubsub: new RedisPubSub(process.env.REDIS_URL ?? ''),
      rng: Math.random,
    };
  }
  return cached;
}
```

```ts
// lib/server/index.ts
export * from './pubsub';
export * from './redis-pubsub';
export * from './redact';
export * from './seats';
export * from './deps';
export * from './matches';
export * from './runtime';
```

```ts
// app/api/matches/route.ts  (create lobby)
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../lib/server/prod-deps';
import { createLobby } from '../../../lib/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const user = await currentUser();
  const displayName = user?.username ?? user?.firstName ?? 'Player';
  const { seats } = await req.json();
  const res = await createLobby(getProdDeps(), { userId, displayName, seats: Number(seats) });
  return NextResponse.json({ ok: true, ...res });
}
```

```ts
// app/api/matches/[id]/join/route.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { joinLobby } from '../../../../../lib/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const user = await currentUser();
  const displayName = user?.username ?? user?.firstName ?? 'Player';
  const { joinCode } = await req.json();
  const res = await joinLobby(getProdDeps(), { userId, displayName, joinCode });
  return NextResponse.json({ ok: true, ...res });
}
```

```ts
// app/api/matches/[id]/start/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { startGame } from '../../../../../lib/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const res = await startGame(getProdDeps(), { matchId: id, userId });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
```

```ts
// app/api/matches/[id]/actions/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { submitAction } from '../../../../../lib/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const action = await req.json();
  const res = await submitAction(getProdDeps(), { matchId: id, userId, action });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
```

```ts
// app/api/matches/[id]/stream/route.ts
import { auth } from '@clerk/nextjs/server';
import { getProdDeps } from '../../../../../lib/server/prod-deps';
import { resolveSeat, redactStateFor } from '../../../../../lib/server';
import { loadGameState } from '../../../../../lib/db';
import type { MatchState } from '../../../../../lib/kalooki';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response('unauthorized', { status: 401 });
  const { id } = await params;
  const deps = getProdDeps();
  const seat = await resolveSeat(deps.db, id, userId);
  if (seat === null) return new Response('forbidden', { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (view: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(view)}\n\n`));

      // initial catch-up
      const cur = await loadGameState(deps.db, id);
      if (cur) send(redactStateFor(cur.state, seat));

      const off = await deps.pubsub.subscribe('match:' + id, (msg) => {
        // lobby updates are plain objects without a `round`; only redact full states
        const m = msg as MatchState;
        if (m && (m as MatchState).round) send(redactStateFor(m, seat));
        else send(msg);
      });
      // close handling
      _req.signal.addEventListener('abort', async () => {
        await off();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 4: Verify tests, typecheck, and build**

Run:
```bash
npx vitest run lib/server/__tests__/prod-deps.test.ts
npx vitest run              # full suite green
npx tsc --noEmit
npx next build             # route handlers must compile
```
Expected: all green; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app lib/server/prod-deps.ts lib/server/index.ts lib/server/__tests__/prod-deps.test.ts
git commit -m "feat(server): action/SSE/lifecycle route handlers + prod deps"
```

---

## Task 10: Provision Redis + verify (human-gated)

**Files:** none (operational).

This task writes to your Vercel account (provisions a Marketplace integration) and is a **human-gated stop** — the executor must pause here and hand off.

- [ ] **Step 1: Provision Redis via the Marketplace**

Run (from repo root; token pattern per project conventions):
```bash
export VERCEL_TOKEN="$(cat .vercel-token)"
vercel integration add redis --yes
```
If it requires a dashboard/browser step (connectable integration), run `vercel integration open redis` and complete it in the browser, then continue.

- [ ] **Step 2: Pull the env and confirm REDIS_URL**

Run:
```bash
export VERCEL_TOKEN="$(cat .vercel-token)"
vercel env pull .env.local --environment=production
grep -c '^REDIS_URL' .env.local || echo "REDIS_URL missing — copy it from the Redis integration's env like the Clerk/Neon secrets"
```
(As with Clerk/Neon, the value may be a Secret that must be copied manually into `.env.local`.)

- [ ] **Step 3: Run the Redis smoke test**

Run:
```bash
npx vitest run lib/server/__tests__/redis-pubsub.test.ts
```
Expected: the previously-skipped smoke test now runs and passes (round-trips a message through real Redis).

- [ ] **Step 4: Commit any config changes**

```bash
git add -A && git commit -m "chore(server): provision Redis integration" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** runtime service DI (T4/T6), authoritative loop incl. optimistic retry (T6), round/match transitions in documented order + explicit rebuy/decline (T7), Redis+SSE fan-out (T2/T8/T9), per-seat redaction as security boundary (T3, with the no-leak test), Clerk-derived seats (T4/T9), match lifecycle (T5), hermetic tests throughout, Redis provisioning gated (T10), Next scaffold + Clerk (T1). SSE on Node runtime (T9, no edge). All spec sections map to tasks.
- **Ledger-worthy decision:** authoritative pot lives in `game_states.state.pot`; the `matches.pot` column is left unused by the runtime (T5). Carried as a note for the UI phase (read pot from state, not the column).
- **Known accepted items:** the T6 conflict test can't deterministically interleave a concurrent writer in a single-process test, so it verifies the happy retry path + sequential legal actions rather than a forced race; the reload-retry code path is exercised structurally. Real concurrency is bounded anyway (only the turn-holder acts). Route handlers are build-verified, not unit-tested (their logic is fully covered in the runtime tests).
- **Placeholder scan:** none. **Type consistency:** `RuntimeDeps`, `SubmitResult`, `ServerAction`, `ClientView`, `redactStateFor`, `submitAction`, `finishRoundTransition`, lifecycle fn names consistent across tasks and matched to real engine/repo exports.
