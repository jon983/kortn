# Kalooki Lobby UI + 5-Player Support (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build kortn's lobby — auth, home, create-table, and a live waiting room in the faded-parlour skin — plus two gameplay extensions: support up to 5 players and randomise seating at the deal.

**Architecture:** Next.js App Router UI over the existing engine/persistence/server layers. A small reusable "parlour" component kit (backdrop, framed panels, place-cards, adaptive table shape) styled with Tailwind v4 theme tokens + `next/font`. Pages are server components that read via existing repos and act via server actions wrapping the existing `createLobby`/`joinLobby`/`startGame`; the waiting room is a client component driven by the existing SSE stream. Two small non-UI changes: 5-player deal tests + `createLobby` seat validation, and randomised seat assignment in `startGame`.

**Tech Stack:** Next.js (App Router) + React, `@clerk/nextjs`, Tailwind CSS v4, `next/font`, Vitest + jsdom + `@testing-library/react`, existing `lib/kalooki` / `lib/db` / `lib/server`.

**Spec:** `docs/superpowers/specs/2026-09-19-kalooki-lobby-ui-design.md` (art: `docs/art-brief.md`)

## Global Constraints

- Name is **Kalooki**; app is **kortn**. Aesthetic = faded 1960s Eastern-European Jewish parlour (bone/sage/walnut/brass/faded-maroon), photographic plates with a CSS fallback.
- **Players: 2–5.** Max is 5. `createLobby` rejects seats outside 2..5. Engine has no seat cap (verified) — add 5-player deal tests, do not add a cap elsewhere.
- **Randomised seating:** at `startGame`, before dealing, shuffle player→seat assignment with the seeded RNG and persist `match_players.seat_index`.
- **Table shape:** square for 2–4, pentagon for 5; one player centered on each **edge/side** (never a corner/vertex).
- Reuse existing server functions (`createLobby`, `joinLobby`, `startGame` in `lib/server`) and repos (`lib/db`) — Phase 4 adds UI + thin server actions + the two extensions, NOT new game logic.
- Server-derived identity only: seat/user come from Clerk `auth()` server-side, never client input.
- Tests: engine/db/server run in the node vitest environment; React component tests use jsdom via a `// @vitest-environment jsdom` docblock. `npx vitest run` must stay green across all; `npx tsc --noEmit` clean (strict); `npx next build` compiles.
- No external CDNs at runtime: fonts via `next/font`, art from `public/art/`.

**Deck facts (for tests):** 5 players → 65 dealt + 1 discard, stock 40. 106-card deck.

---

## File Structure

- `lib/kalooki/__tests__/deal-5p.test.ts` — 5-player deal test (engine unchanged).
- `lib/server/matches.ts` — modify `createLobby` (validate 2..5) + `startGame` (randomise seats).
- `lib/server/__tests__/seating.test.ts` — randomised-seating + seat-validation tests.
- `lib/db/repositories/users.ts` — add `getUserStats`.
- `app/globals.css` — Tailwind v4 import + `@theme` parlour tokens.
- `lib/ui/fonts.ts` — `next/font` display + body faces.
- `lib/ui/RoomBackdrop.tsx`, `Framed.tsx`, `PlaceCard.tsx`, `LampButton.tsx`, `TableShape.tsx` — parlour kit.
- `lib/ui/__tests__/*.test.tsx` — component + geometry tests.
- `lib/ui/table-geometry.ts` — pure seat-position math (square/pentagon).
- `app/actions/lobby.ts` — `createTableAction`, `joinTableAction` (server actions).
- `app/(auth)/sign-in/[[...rest]]/page.tsx`, `app/(auth)/sign-up/[[...rest]]/page.tsx` — Clerk pages.
- `app/page.tsx` — home (rewrite the scaffold placeholder).
- `app/create/page.tsx` — create table.
- `app/match/[id]/lobby/page.tsx` + `WaitingRoom.tsx` (client) — waiting room.
- `app/match/[id]/table/page.tsx` — Phase-5 placeholder ("the game will appear here").

---

## Task 1: 5-player support (engine tests + lobby validation)

**Files:**
- Create: `lib/kalooki/__tests__/deal-5p.test.ts`
- Modify: `lib/server/matches.ts` (createLobby seat validation)
- Test: `lib/server/__tests__/create-validation.test.ts`

**Interfaces:**
- Consumes: `startMatch`, `dealRound`, `makeRng` from `lib/kalooki`; `createLobby` from `lib/server`.
- Produces: `createLobby` throws `Error('Seats must be between 2 and 5')` when `seats < 2 || seats > 5`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/kalooki/__tests__/deal-5p.test.ts
import { describe, it, expect } from 'vitest';
import { startMatch } from '../index';

describe('5-player deal', () => {
  it('deals 13 to each of 5 seats, stock 40, no card lost', () => {
    const m = startMatch({ seats: 5, seed: 12 });
    expect(m.round.players).toHaveLength(5);
    for (const p of m.round.players) expect(p.hand).toHaveLength(13);
    expect(m.round.discard).toHaveLength(1);
    expect(m.round.stock).toHaveLength(40); // 106 - 65 - 1
    const all = [...m.round.stock, ...m.round.discard, ...m.round.players.flatMap((p) => p.hand)];
    expect(all).toHaveLength(106);
    expect(new Set(all.map((c) => c.id)).size).toBe(106);
    expect(m.pot).toBe(20); // 5 * 4
  });
});
```

```ts
// lib/server/__tests__/create-validation.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby } from '../matches';
import { makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });
const deps = (db: any) => ({ db, pubsub: new InMemoryPubSub(), rng: makeRng(1) });

describe('createLobby seat validation', () => {
  it('accepts 2..5 and rejects outside', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const ok = await createLobby(deps(db) as any, { userId: 'u1', displayName: 'A', seats: 5 });
    expect(ok.matchId).toBeTruthy();
    await expect(createLobby(deps(db) as any, { userId: 'u1', displayName: 'A', seats: 6 })).rejects.toThrow();
    await expect(createLobby(deps(db) as any, { userId: 'u1', displayName: 'A', seats: 1 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/kalooki/__tests__/deal-5p.test.ts lib/server/__tests__/create-validation.test.ts`
Expected: deal-5p passes already (engine supports it); create-validation FAILS (no validation yet).

- [ ] **Step 3: Add the validation**

In `lib/server/matches.ts`, at the top of `createLobby` (before `upsertUser`):

```ts
if (!Number.isInteger(input.seats) || input.seats < 2 || input.seats > 5) {
  throw new Error('Seats must be between 2 and 5');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/kalooki lib/server && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/kalooki/__tests__/deal-5p.test.ts lib/server/matches.ts lib/server/__tests__/create-validation.test.ts
git commit -m "feat(lobby): 5-player support (deal tests + createLobby 2..5 validation)"
```

---

## Task 2: Randomised seating at deal

**Files:**
- Modify: `lib/server/matches.ts` (`startGame`)
- Test: `lib/server/__tests__/seating.test.ts`

**Interfaces:**
- Consumes: `listPlayers`, `updatePlayer` from `lib/db`; `shuffle`, `startMatch` from `lib/kalooki`; `RuntimeDeps`.
- Produces: `startGame` reassigns each joined player to a random seat (a permutation of `0..seats-1`) using `deps.rng` before dealing; persists via `updatePlayer` (seat reassignment) so `match_players.seat_index` reflects the shuffled order.

Note: `updatePlayer(db, matchId, seatIndex, fields)` keys on the *current* seat; reassigning seats requires care to avoid composite-PK collisions mid-update. Implement by moving all players to temporary negative seat indices first, then to their final shuffled seats. Add a tiny helper `reseatPlayers`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/server/__tests__/seating.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby, joinLobby, startGame } from '../matches';
import { listPlayers, getMatch } from '../../db';
import { makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });
const deps = (db: any, seed = 5) => ({ db, pubsub: new InMemoryPubSub(), rng: makeRng(seed) });

describe('randomised seating', () => {
  it('assigns every player a unique seat covering 0..n-1 (a permutation)', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = deps(db, 7);
    const { matchId } = await createLobby(d as any, { userId: 'u1', displayName: 'A', seats: 4 });
    for (const u of ['u2', 'u3', 'u4']) {
      await joinLobby(d as any, { userId: u, displayName: u, joinCode: (await getMatch(db as any, matchId))!.joinCode });
    }
    await startGame(d as any, { matchId, userId: 'u1' });

    const players = await listPlayers(db as any, matchId);
    const seats = players.map((p) => p.seatIndex).sort();
    expect(seats).toEqual([0, 1, 2, 3]);                 // permutation, all seats covered
    expect(new Set(players.map((p) => p.userId)).size).toBe(4); // every user present exactly once
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/server/__tests__/seating.test.ts`
Expected: FAIL only if a bug — but since seats currently follow join order they'd already be `[0,1,2,3]`; to make the test meaningful, ALSO assert the mapping changed vs join order for at least one seed. Add:

```ts
    // with this seed the shuffle must differ from join order for at least one seat
    const joinOrder = ['u1', 'u2', 'u3', 'u4'];
    const bySeat = [...players].sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.userId);
    expect(bySeat).not.toEqual(joinOrder);
```
Expected now: FAIL (join order preserved — no shuffle yet).

- [ ] **Step 3: Implement randomised reseating**

In `lib/server/matches.ts`, add a helper and call it in `startGame` before `engineStartMatch`:

```ts
import { shuffle } from '../kalooki';

async function reseatPlayers(deps: RuntimeDeps, matchId: string): Promise<void> {
  const players = await listPlayers(deps.db, matchId);
  const seats = shuffle(players.map((_, i) => i), deps.rng); // permutation of 0..n-1
  // Phase 1: park everyone at temporary negative seats to avoid composite-PK collisions.
  for (let i = 0; i < players.length; i++) {
    await updatePlayer(deps.db, matchId, players[i].seatIndex, { });   // no-op guard if needed
  }
  // move to temp negatives keyed by userId order
  for (let i = 0; i < players.length; i++) {
    await reseatOne(deps, matchId, players[i].seatIndex, -(i + 1));
  }
  // assign final shuffled seats
  for (let i = 0; i < players.length; i++) {
    await reseatOne(deps, matchId, -(i + 1), seats[i]);
  }
}
```

`updatePlayer` cannot change the seat (it's the PK). Add a dedicated `reseatOne` in the repo. In `lib/db/repositories/players.ts`:

```ts
export async function reseatOne(db: DB, matchId: string, fromSeat: number, toSeat: number): Promise<void> {
  await db.update(matchPlayers).set({ seatIndex: toSeat })
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.seatIndex, fromSeat)));
}
```
(export it, and import `reseatOne` into `matches.ts`; drop the no-op loop above — the two reseat passes are the implementation.) Then in `startGame`, after the "seats filled" check and before `engineStartMatch`:

```ts
await reseatPlayers(deps, input.matchId);
```

Cleaned-up helper:
```ts
async function reseatPlayers(deps: RuntimeDeps, matchId: string): Promise<void> {
  const players = await listPlayers(deps.db, matchId);
  const targets = shuffle(players.map((_, i) => i), deps.rng);
  for (let i = 0; i < players.length; i++) await reseatOne(deps.db, matchId, players[i].seatIndex, -(i + 1));
  for (let i = 0; i < players.length; i++) await reseatOne(deps.db, matchId, -(i + 1), targets[i]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/server && npx tsc --noEmit`
Expected: all green (the shuffled order differs from join order for the seed; seats are a permutation).

- [ ] **Step 5: Commit**

```bash
git add lib/server/matches.ts lib/db/repositories/players.ts lib/server/__tests__/seating.test.ts
git commit -m "feat(lobby): randomise player seating at deal"
```

---

## Task 3: UI foundation — Tailwind, fonts, parlour tokens, RTL test infra

**Files:**
- Modify: `package.json` (Tailwind + RTL deps), `app/globals.css`, `app/layout.tsx` (import globals + fonts)
- Create: `lib/ui/fonts.ts`, `vitest.setup.ts`, `lib/ui/__tests__/smoke.test.tsx`
- Modify: `vitest.config.ts` (jsdom setup file wiring)

**Interfaces:**
- Produces: parlour CSS tokens (`--parlour-*` / Tailwind theme colors `bone`, `sage`, `walnut`, `brass`, `maroon`, `blueish`), exported fonts `displayFont`, `bodyFont` (with `.variable` class names), and a working jsdom + `@testing-library/react` setup.

- [ ] **Step 1: Install deps**

Run:
```bash
npm install -D tailwindcss @tailwindcss/postcss @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Write the failing test**

```tsx
// lib/ui/__tests__/smoke.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello() { return <div>shalom</div>; }

describe('rtl smoke', () => {
  it('renders a component in jsdom', () => {
    render(<Hello />);
    expect(screen.getByText('shalom')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/ui/__tests__/smoke.test.tsx`
Expected: FAIL — `toBeInTheDocument` matcher / jsdom not set up.

- [ ] **Step 4: Wire up config, tokens, fonts**

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`vitest.config.ts` — add a setupFiles entry (keep default node env; jsdom is per-file via docblock):
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-bone: #e7e1cf;
  --color-sage: #93a277;
  --color-sage-deep: #71835c;
  --color-walnut: #5f4127;
  --color-walnut-dark: #402c1a;
  --color-brass: #b9963f;
  --color-maroon: #7a3746;
  --color-blueish: #4d6a8a;
  --color-ink: #3a4030;
}

:root { color-scheme: dark; }
body { background: #201811; color: var(--color-bone); }
```

`lib/ui/fonts.ts`:
```ts
import { DM_Serif_Display, Zilla_Slab } from 'next/font/google';

export const displayFont = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-display' });
export const bodyFont = Zilla_Slab({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-body' });
```

`app/layout.tsx` — import globals + apply font variables (merge into the existing ClerkProvider layout):
```tsx
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { displayFont, bodyFont } from '../lib/ui/fonts';

export const metadata = { title: 'kortn — Kalooki', description: 'Online Kalooki in the front room' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 5: Run test + build**

Run: `npx vitest run lib/ui/__tests__/smoke.test.tsx && npx vitest run && npx tsc --noEmit && npx next build`
Expected: all green; build compiles with Tailwind.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts postcss.config.mjs app/globals.css app/layout.tsx lib/ui/fonts.ts lib/ui/__tests__/smoke.test.tsx
git commit -m "feat(ui): Tailwind v4 parlour tokens, fonts, RTL/jsdom test infra"
```

---

## Task 4: Table geometry + TableShape component

**Files:**
- Create: `lib/ui/table-geometry.ts`, `lib/ui/TableShape.tsx`
- Test: `lib/ui/__tests__/table-geometry.test.ts`, `lib/ui/__tests__/table-shape.test.tsx`

**Interfaces:**
- Produces:
  - `type SeatPos = { seat: number; xPct: number; yPct: number }`
  - `function seatPositions(seats: number): SeatPos[]` — for 2–4 returns positions centered on the sides of a square; for 5, centered on the 5 edges of a point-up pentagon. `xPct`/`yPct` are 0–100 within the table stage. 2 → opposite sides (top/bottom); 3 → top/right/left (three sides); 4 → all four sides; 5 → pentagon edges.
  - `function tableKind(seats: number): 'square' | 'pentagon'` — `seats === 5 ? 'pentagon' : 'square'`.
  - `TableShape` React component rendering the felt polygon + seat slots (children by seat).

- [ ] **Step 1: Write the failing test**

```ts
// lib/ui/__tests__/table-geometry.test.ts
import { describe, it, expect } from 'vitest';
import { seatPositions, tableKind } from '../table-geometry';

describe('table geometry', () => {
  it('chooses square for 2-4, pentagon for 5', () => {
    for (const n of [2, 3, 4]) expect(tableKind(n)).toBe('square');
    expect(tableKind(5)).toBe('pentagon');
  });

  it('returns one position per seat, all within 0..100, none at exact corners', () => {
    for (const n of [2, 3, 4, 5]) {
      const pos = seatPositions(n);
      expect(pos).toHaveLength(n);
      expect(new Set(pos.map((p) => p.seat))).toEqual(new Set([...Array(n).keys()]));
      for (const p of pos) {
        expect(p.xPct).toBeGreaterThanOrEqual(0);
        expect(p.xPct).toBeLessThanOrEqual(100);
        expect(p.yPct).toBeGreaterThanOrEqual(0);
        expect(p.yPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it('places 2 players on opposite sides (top & bottom)', () => {
    const p = seatPositions(2).sort((a, b) => a.yPct - b.yPct);
    expect(p[0].xPct).toBeCloseTo(50, 0);   // top centered
    expect(p[1].xPct).toBeCloseTo(50, 0);   // bottom centered
    expect(p[1].yPct - p[0].yPct).toBeGreaterThan(50); // clearly opposite
  });

  it('pentagon seats sit on edges (none at the top vertex x=50,y=0)', () => {
    const p = seatPositions(5);
    for (const s of p) expect(!(Math.abs(s.xPct - 50) < 1 && s.yPct < 3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/__tests__/table-geometry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement geometry + component**

```ts
// lib/ui/table-geometry.ts
export type SeatPos = { seat: number; xPct: number; yPct: number };

export function tableKind(seats: number): 'square' | 'pentagon' {
  return seats === 5 ? 'pentagon' : 'square';
}

// Square side midpoints, ordered: top, right, bottom, left.
const SQUARE_SIDES: Array<[number, number]> = [
  [50, 2], [98, 50], [50, 98], [2, 50],
];
// For 2 players use opposite sides (top, bottom); 3 use top,right,left; 4 use all.
const SQUARE_BY_COUNT: Record<number, Array<[number, number]>> = {
  2: [SQUARE_SIDES[0], SQUARE_SIDES[2]],
  3: [SQUARE_SIDES[0], SQUARE_SIDES[1], SQUARE_SIDES[3]],
  4: SQUARE_SIDES,
};

// Pentagon (point up) edge midpoints, computed once. Vertices at angles 90,162,234,306,18 deg.
function pentagonEdgeMidpoints(): Array<[number, number]> {
  const cx = 50, cy = 52, r = 52;
  const vAng = [90, 162, 234, 306, 18].map((d) => (d * Math.PI) / 180);
  const verts = vAng.map((a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)] as [number, number]);
  const mids: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    const a = verts[i], b = verts[(i + 1) % 5];
    mids.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  return mids;
}

export function seatPositions(seats: number): SeatPos[] {
  const raw = seats === 5 ? pentagonEdgeMidpoints() : SQUARE_BY_COUNT[seats];
  if (!raw) throw new Error(`Unsupported seat count: ${seats}`);
  return raw.map(([x, y], seat) => ({
    seat,
    xPct: Math.max(0, Math.min(100, x)),
    yPct: Math.max(0, Math.min(100, y)),
  }));
}
```

```tsx
// lib/ui/TableShape.tsx
import type { ReactNode } from 'react';
import { seatPositions, tableKind } from './table-geometry';

const PENTAGON_CLIP = 'polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)';

export function TableShape({
  seats,
  renderSeat,
}: {
  seats: number;
  renderSeat: (seat: number) => ReactNode;
}) {
  const kind = tableKind(seats);
  const positions = seatPositions(seats);
  return (
    <div className="relative aspect-square w-full max-w-[420px] mx-auto">
      <div
        className="absolute inset-[16%] bg-[radial-gradient(circle_at_50%_40%,#3f6b46,#2c4d32_72%,#223c27)] shadow-[0_16px_34px_rgba(0,0,0,.5)]"
        style={kind === 'pentagon' ? { clipPath: PENTAGON_CLIP } : { borderRadius: 14, border: '10px solid var(--color-walnut-dark)' }}
      />
      {positions.map((p) => (
        <div
          key={p.seat}
          className="absolute w-[26%] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
          data-seat={p.seat}
        >
          {renderSeat(p.seat)}
        </div>
      ))}
    </div>
  );
}
```

```tsx
// lib/ui/__tests__/table-shape.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TableShape } from '../TableShape';

describe('TableShape', () => {
  it('renders one seat slot per seat', () => {
    const { container } = render(<TableShape seats={5} renderSeat={(s) => <span>seat{s}</span>} />);
    expect(container.querySelectorAll('[data-seat]')).toHaveLength(5);
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/ui && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/table-geometry.ts lib/ui/TableShape.tsx lib/ui/__tests__/table-geometry.test.ts lib/ui/__tests__/table-shape.test.tsx
git commit -m "feat(ui): adaptive TableShape (square 2-4 / pentagon 5, seats on edges)"
```

---

## Task 5: Parlour kit — RoomBackdrop, Framed, PlaceCard, LampButton

**Files:**
- Create: `lib/ui/RoomBackdrop.tsx`, `lib/ui/Framed.tsx`, `lib/ui/PlaceCard.tsx`, `lib/ui/LampButton.tsx`
- Test: `lib/ui/__tests__/kit.test.tsx`

**Interfaces:**
- Produces:
  - `RoomBackdrop({ plate?: string; children })` — renders `children` over `public/art/<plate>.webp` when `plate` is given, else the CSS parlour fallback gradient; always adds a vignette + grain overlay. When `plate` is set it uses a `<div style={{backgroundImage:url(/art/${plate}.webp)}}>`; missing files degrade to the gradient (the gradient is always the base layer beneath).
  - `Framed({ title?, children, className? })` — a slightly-askew framed-notice panel (walnut border, gilt inner line, bone bg).
  - `PlaceCard({ name?, subtitle?, host?, empty? })` — a seat/name card; `empty` renders the "waiting…" hatched style.
  - `LampButton({ children, ...buttonProps })` — the warm primary button; forwards native button props.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/__tests__/kit.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoomBackdrop } from '../RoomBackdrop';
import { Framed } from '../Framed';
import { PlaceCard } from '../PlaceCard';
import { LampButton } from '../LampButton';

describe('parlour kit', () => {
  it('RoomBackdrop renders children and falls back without a plate', () => {
    render(<RoomBackdrop><p>inside</p></RoomBackdrop>);
    expect(screen.getByText('inside')).toBeInTheDocument();
  });
  it('RoomBackdrop references the plate url when given', () => {
    const { container } = render(<RoomBackdrop plate="room-home"><i>x</i></RoomBackdrop>);
    expect(container.innerHTML).toContain('/art/room-home.webp');
  });
  it('Framed shows its title', () => {
    render(<Framed title="At the table"><div>rows</div></Framed>);
    expect(screen.getByText('At the table')).toBeInTheDocument();
  });
  it('PlaceCard shows a name, and empty state', () => {
    render(<><PlaceCard name="Ruth" /><PlaceCard empty /></>);
    expect(screen.getByText('Ruth')).toBeInTheDocument();
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });
  it('LampButton forwards onClick/label', () => {
    render(<LampButton>Deal us in</LampButton>);
    expect(screen.getByRole('button', { name: 'Deal us in' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/__tests__/kit.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the components**

```tsx
// lib/ui/RoomBackdrop.tsx
import type { ReactNode } from 'react';

export function RoomBackdrop({ plate, children }: { plate?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden isolate font-[family-name:var(--font-body)]">
      {/* base fallback gradient (always present) */}
      <div className="absolute inset-0 -z-20"
        style={{ background: 'linear-gradient(180deg,#e7e1cf 0%,#e1dbc8 42%,var(--color-sage) 42.5%,var(--color-sage-deep) 82%,#7f8a94 82.5%,#67737d 100%)' }} />
      {/* photographic plate over the fallback */}
      {plate && (
        <div className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `url(/art/${plate}.webp)` }} />
      )}
      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 -z-[5]"
        style={{ background: 'radial-gradient(120% 100% at 50% 42%, transparent 55%, rgba(30,26,18,.5) 100%)' }} />
      {children}
    </div>
  );
}
```

```tsx
// lib/ui/Framed.tsx
import type { ReactNode } from 'react';

export function Framed({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-bone text-ink border-[7px] border-walnut rounded-[2px] p-4 shadow-[0_10px_20px_rgba(0,0,0,.35),inset_0_0_0_2px_var(--color-brass)] -rotate-[.6deg] ${className}`}>
      {title && (
        <h3 className="text-center text-maroon font-[family-name:var(--font-display)] text-base mb-2 pb-1 border-b border-brass">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
```

```tsx
// lib/ui/PlaceCard.tsx
export function PlaceCard({ name, subtitle, host, empty }: { name?: string; subtitle?: string; host?: boolean; empty?: boolean }) {
  if (empty) {
    return (
      <div className="rounded-lg p-2 text-center border border-[#cbc4ad] text-[#8a7f66] italic text-xs"
        style={{ background: 'repeating-linear-gradient(45deg,#e3ddca,#e3ddca 6px,#dcd5bf 6px,#dcd5bf 12px)' }}>
        <div className="mx-auto mb-1 h-6 w-6 rounded-full bg-[#cfc7ad]" />
        waiting…
      </div>
    );
  }
  return (
    <div className="rounded-lg p-2 text-center border border-brass bg-[linear-gradient(180deg,#f6efd8,#e9dfbe)] shadow-[0_5px_10px_rgba(0,0,0,.3)]">
      <div className="mx-auto mb-1 h-6 w-6 rounded-full bg-[radial-gradient(circle_at_40%_35%,#8a7a63,#5b4a37)]" />
      <div className="text-[13px] font-bold text-[#4a3320]">{name}</div>
      {host && <div className="text-[8px] uppercase tracking-wider text-maroon">host</div>}
      {subtitle && <div className="text-[10px] text-[#6a6250]">{subtitle}</div>}
    </div>
  );
}
```

```tsx
// lib/ui/LampButton.tsx
import type { ButtonHTMLAttributes } from 'react';

export function LampButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`font-[family-name:var(--font-body)] font-bold text-bone border-2 border-walnut-dark rounded-md px-6 py-3
        bg-[linear-gradient(180deg,var(--color-walnut),var(--color-walnut-dark))]
        shadow-[0_5px_10px_rgba(0,0,0,.4)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/ui && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/RoomBackdrop.tsx lib/ui/Framed.tsx lib/ui/PlaceCard.tsx lib/ui/LampButton.tsx lib/ui/__tests__/kit.test.tsx
git commit -m "feat(ui): parlour kit (RoomBackdrop, Framed, PlaceCard, LampButton)"
```

---

## Task 6: Data reads + server actions

**Files:**
- Modify: `lib/db/repositories/users.ts` (add `getUserStats`)
- Create: `app/actions/lobby.ts`
- Test: `lib/db/__tests__/user-stats.test.ts`

**Interfaces:**
- Consumes: `db`, repos, `getProdDeps`, `createLobby`, `joinLobby` from `lib/server`; Clerk `auth`, `currentUser`.
- Produces:
  - `getUserStats(db, userId): Promise<{ gamesPlayed: number; roundsWon: number; bitsNet: number } | null>`
  - `createTableAction(formData)` server action → `{ matchId, joinCode }` (auth'd) — redirects handled by caller.
  - `joinTableAction(formData)` server action → `{ matchId }` or `{ error }`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/user-stats.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser, incrementUserStats, getUserStats } from '../index';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('getUserStats', () => {
  it('returns cumulative stats, null for unknown', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await incrementUserStats(db as any, 'u1', { gamesPlayed: 2, roundsWon: 5, bitsNet: -3 });
    expect(await getUserStats(db as any, 'u1')).toEqual({ gamesPlayed: 2, roundsWon: 5, bitsNet: -3 });
    expect(await getUserStats(db as any, 'nobody')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/user-stats.test.ts`
Expected: FAIL — `getUserStats` undefined.

- [ ] **Step 3: Implement**

```ts
// add to lib/db/repositories/users.ts
import { eq } from 'drizzle-orm';

export async function getUserStats(db: DB, userId: string): Promise<{ gamesPlayed: number; roundsWon: number; bitsNet: number } | null> {
  const [u] = await db.select({
    gamesPlayed: users.gamesPlayed, roundsWon: users.roundsWon, bitsNet: users.bitsNet,
  }).from(users).where(eq(users.id, userId)).limit(1);
  return u ?? null;
}
```

```ts
// app/actions/lobby.ts
'use server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getProdDeps, createLobby, joinLobby } from '../../lib/server';

async function displayName(): Promise<string> {
  const u = await currentUser();
  return u?.username ?? u?.firstName ?? 'Player';
}

export async function createTableAction(formData: FormData): Promise<{ matchId: string; joinCode: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const seats = Number(formData.get('seats'));
  return createLobby(getProdDeps(), { userId, displayName: await displayName(), seats });
}

export async function joinTableAction(formData: FormData): Promise<{ matchId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const joinCode = String(formData.get('joinCode') ?? '').trim().toUpperCase();
  try {
    const { matchId } = await joinLobby(getProdDeps(), { userId, displayName: await displayName(), joinCode });
    return { matchId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
```

Add `export * from './repositories/users'` already covers `getUserStats` via the barrel (no change needed).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db && npx tsc --noEmit`
Expected: PASS. (Server actions are validated by `next build` in Task 7/9.)

- [ ] **Step 5: Commit**

```bash
git add lib/db/repositories/users.ts app/actions/lobby.ts lib/db/__tests__/user-stats.test.ts
git commit -m "feat(lobby): getUserStats + create/join server actions"
```

---

## Task 7: Auth pages + home screen

**Files:**
- Create: `app/(auth)/sign-in/[[...rest]]/page.tsx`, `app/(auth)/sign-up/[[...rest]]/page.tsx`, `app/match/[id]/table/page.tsx` (placeholder)
- Modify: `app/page.tsx` (rewrite scaffold), `middleware.ts` (protect app routes)
- Test: (build-verified; logic already covered)

**Interfaces:**
- Consumes: Clerk components, `RoomBackdrop`/`Framed`/`LampButton`, `db`, `listMatchesForUser`, `getUserStats`, `auth`.
- Produces: `/`, `/sign-in`, `/sign-up`, `/match/[id]/table` (placeholder) routes.

- [ ] **Step 1: Write the pages**

`app/(auth)/sign-in/[[...rest]]/page.tsx`:
```tsx
import { SignIn } from '@clerk/nextjs';
import { RoomBackdrop } from '../../../../lib/ui/RoomBackdrop';

export default function Page() {
  return (
    <RoomBackdrop plate="room-signin">
      <div className="flex min-h-screen items-center justify-center p-6">
        <SignIn />
      </div>
    </RoomBackdrop>
  );
}
```

`app/(auth)/sign-up/[[...rest]]/page.tsx`:
```tsx
import { SignUp } from '@clerk/nextjs';
import { RoomBackdrop } from '../../../../lib/ui/RoomBackdrop';

export default function Page() {
  return (
    <RoomBackdrop plate="room-signin">
      <div className="flex min-h-screen items-center justify-center p-6">
        <SignUp />
      </div>
    </RoomBackdrop>
  );
}
```

`app/match/[id]/table/page.tsx` (Phase-5 placeholder):
```tsx
export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="flex min-h-screen items-center justify-center text-bone">The game table for {id} will appear here (Phase 5).</main>;
}
```

`app/page.tsx` (home):
```tsx
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, listMatchesForUser, getUserStats } from '../lib/db';
import { RoomBackdrop } from '../lib/ui/RoomBackdrop';
import { Framed } from '../lib/ui/Framed';
import { LampButton } from '../lib/ui/LampButton';

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [matches, stats] = await Promise.all([
    listMatchesForUser(db, userId),
    getUserStats(db, userId),
  ]);
  const active = matches.filter((m) => m.status === 'lobby' || m.status === 'active');

  return (
    <RoomBackdrop plate="room-home">
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-display)] text-6xl text-brass drop-shadow">kortn</h1>
          <p className="italic text-bone/80">— sit, we were just about to deal —</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/create"><LampButton>Set the table</LampButton></Link>
            <Link href="#join"><LampButton className="!bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] !text-ink !border-sage-deep">Pull up a chair</LampButton></Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <Framed title="At the table">
            {active.length === 0 && <p className="text-sm text-ink/70 p-2">No games yet — set the table.</p>}
            {active.map((m) => (
              <Link key={m.id} href={`/match/${m.id}/${m.status === 'lobby' ? 'lobby' : 'table'}`}
                className="flex justify-between p-2 text-sm border-b border-dotted border-[#b0a98f] hover:bg-black/5">
                <span>{m.status === 'lobby' ? 'Lobby' : 'Game'} · {m.seats} seats</span>
                <span className="uppercase text-[10px] tracking-wide text-maroon">{m.status} ▸</span>
              </Link>
            ))}
          </Framed>
          <Framed title="Your record">
            <Stat label="Games played" value={stats?.gamesPlayed ?? 0} />
            <Stat label="Rounds won" value={stats?.roundsWon ?? 0} />
            <Stat label="Bits, net" value={(stats?.bitsNet ?? 0) > 0 ? `+${stats?.bitsNet}` : String(stats?.bitsNet ?? 0)} />
          </Framed>
        </div>

        <JoinBox />
      </main>
    </RoomBackdrop>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between p-2 text-sm border-b border-dotted border-[#b0a98f]">
      <span>{label}</span><b className="text-walnut">{value}</b>
    </div>
  );
}

import { JoinBox } from './JoinBox';
```

`app/JoinBox.tsx` (client, join-by-code):
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinTableAction } from './actions/lobby';
import { Framed } from '../lib/ui/Framed';
import { LampButton } from '../lib/ui/LampButton';

export function JoinBox() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function action(fd: FormData) {
    setError(null);
    const res = await joinTableAction(fd);
    if ('error' in res) setError(res.error);
    else router.push(`/match/${res.matchId}/lobby`);
  }
  return (
    <div id="join" className="mt-8 max-w-sm mx-auto">
      <Framed title="Pull up a chair">
        <form action={action} className="flex flex-col gap-3 p-1">
          <input name="joinCode" placeholder="TABLE CODE" maxLength={4}
            className="rounded border border-brass bg-bone/90 px-3 py-2 text-center uppercase tracking-widest text-ink" />
          <LampButton type="submit">Join</LampButton>
          {error && <p className="text-maroon text-sm text-center">{error}</p>}
        </form>
      </Framed>
    </div>
  );
}
```

`middleware.ts` — protect everything except auth + public assets (Clerk's `auth.protect()` pattern per Wordlympics note: use redirect, not protect(), to avoid 404s):
```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublic = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }
});

export const config = { matcher: ['/((?!_next|.*\\..*).*)', '/api/(.*)'] };
```

Set env for Clerk sign-in/up URLs in `.env.local` and Vercel: `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` (note in report; do not commit secrets).

- [ ] **Step 2: Build to verify**

Run: `npx vitest run && npx tsc --noEmit && npx next build`
Expected: all green; routes `/`, `/sign-in`, `/sign-up`, `/create` (next task adds it — if building before Task 8, the `/create` Link is fine as a dead link; build still passes), `/match/[id]/table` compile.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)" app/page.tsx app/JoinBox.tsx app/match middleware.ts
git commit -m "feat(lobby): auth pages, home screen, join-by-code, route protection"
```

---

## Task 8: Create-table page

**Files:**
- Create: `app/create/page.tsx`, `app/create/CreateForm.tsx`
- Test: `lib/ui/__tests__/create-form.test.tsx`

**Interfaces:**
- Consumes: `createTableAction`, `RoomBackdrop`, `Framed`, `LampButton`.
- Produces: `/create` route with a 2–5 seat selector that calls `createTableAction` and routes to the waiting room.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/__tests__/create-form.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateForm } from '../../../app/create/CreateForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('CreateForm', () => {
  it('offers seat options 2..5 and defaults to 4', () => {
    render(<CreateForm />);
    for (const n of [2, 3, 4, 5]) expect(screen.getByRole('button', { name: new RegExp(`^${n}$`) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^4$/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('lets you pick a different seat count', () => {
    render(<CreateForm />);
    fireEvent.click(screen.getByRole('button', { name: /^5$/ }));
    expect(screen.getByRole('button', { name: /^5$/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/__tests__/create-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// app/create/CreateForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTableAction } from '../actions/lobby';
import { LampButton } from '../../lib/ui/LampButton';

export function CreateForm() {
  const router = useRouter();
  const [seats, setSeats] = useState(4);
  async function submit() {
    const fd = new FormData();
    fd.set('seats', String(seats));
    const { matchId } = await createTableAction(fd);
    router.push(`/match/${matchId}/lobby`);
  }
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-widest text-[#8a7f66] mb-3">Chairs at the table</div>
      <div className="flex justify-center gap-3">
        {[2, 3, 4, 5].map((n) => (
          <button key={n} aria-pressed={seats === n} onClick={() => setSeats(n)}
            className={`w-16 rounded-lg border-2 py-3 font-[family-name:var(--font-display)] text-2xl
              ${seats === n ? 'border-walnut bg-[linear-gradient(180deg,#c6d0b3,#a6b589)] text-walnut' : 'border-[#cbbf9c] bg-[#efe9d8] text-walnut/80'}`}>
            {n}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink/70">Buy-in: <b className="text-maroon">4 bits</b> each into the pot</p>
      <div className="mt-4"><LampButton onClick={submit}>Deal us in ▸</LampButton></div>
      <p className="mt-3 text-xs italic text-ink/60">You'll get a code to send round — nobody's dealt until everyone's seated.</p>
    </div>
  );
}
```

```tsx
// app/create/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { RoomBackdrop } from '../../lib/ui/RoomBackdrop';
import { Framed } from '../../lib/ui/Framed';
import { CreateForm } from './CreateForm';

export default async function CreatePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return (
    <RoomBackdrop plate="room-home">
      <main className="mx-auto max-w-md px-5 py-14">
        <h1 className="text-center font-[family-name:var(--font-display)] text-3xl text-brass mb-4">Set the table</h1>
        <Framed><CreateForm /></Framed>
      </main>
    </RoomBackdrop>
  );
}
```

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run lib/ui && npx tsc --noEmit && npx next build`
Expected: PASS; `/create` compiles.

- [ ] **Step 5: Commit**

```bash
git add app/create lib/ui/__tests__/create-form.test.tsx
git commit -m "feat(lobby): create-table page (2-5 seat selector)"
```

---

## Task 9: Waiting room (live fill + deal)

**Files:**
- Create: `app/match/[id]/lobby/page.tsx`, `app/match/[id]/lobby/WaitingRoom.tsx`, `app/actions/match.ts`
- Test: `lib/ui/__tests__/waiting-room.test.tsx`

**Interfaces:**
- Consumes: `db`, `getMatch`, `listPlayers` (via a server action), `startGame` (server action), `TableShape`, `PlaceCard`, `LampButton`, `RoomBackdrop`; SSE stream `/api/matches/[id]/stream`.
- Produces:
  - `app/actions/match.ts`: `getLobbyState(matchId)` → `{ seats, hostUserId, players: {seat, name}[], status }`; `startGameAction(matchId)` → `SubmitResult`.
  - `WaitingRoom` client component: renders `TableShape` with seats filled from `players`, shows the code, subscribes to SSE, refetches on `lobby` pings, enables Deal (host only, when full), navigates to `/match/[id]/table` when status becomes `active`.

- [ ] **Step 1: Write the failing test**

```tsx
// lib/ui/__tests__/waiting-room.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../app/actions/match', () => ({
  getLobbyState: vi.fn(async () => ({ seats: 4, hostUserId: 'u1', status: 'lobby',
    players: [{ seat: 0, name: 'You' }, { seat: 1, name: 'Ruth' }] })),
  startGameAction: vi.fn(async () => ({ ok: true })),
}));
// jsdom lacks EventSource
beforeEach(() => { (globalThis as any).EventSource = class { close() {} addEventListener() {} onmessage: any; }; });

import { WaitingRoom } from '../../../app/match/[id]/lobby/WaitingRoom';

describe('WaitingRoom', () => {
  it('shows the code, seated names, empty seats, and a disabled Deal until full', async () => {
    render(<WaitingRoom matchId="m1" joinCode="MIRZ" viewerId="u1"
      initial={{ seats: 4, hostUserId: 'u1', status: 'lobby', players: [{ seat: 0, name: 'You' }, { seat: 1, name: 'Ruth' }] }} />);
    expect(screen.getByText('MIRZ')).toBeInTheDocument();
    expect(screen.getByText('Ruth')).toBeInTheDocument();
    expect(screen.getAllByText(/waiting/i).length).toBeGreaterThan(0);   // 2 empty seats
    expect(screen.getByRole('button', { name: /deal/i })).toBeDisabled(); // not full
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ui/__tests__/waiting-room.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// app/actions/match.ts
'use server';
import { auth } from '@clerk/nextjs/server';
import { getProdDeps, startGame } from '../../lib/server';
import { db, getMatch, listPlayers } from '../../lib/db';
import { currentUser } from '@clerk/nextjs/server';

export type LobbyState = {
  seats: number; hostUserId: string; status: string;
  players: { seat: number; name: string }[];
};

export async function getLobbyState(matchId: string): Promise<LobbyState> {
  const match = await getMatch(db, matchId);
  if (!match) throw new Error('No such match');
  const players = await listPlayers(db, matchId);
  // display names are mirrored to users; join for names
  const names = new Map<string, string>();
  for (const p of players) names.set(p.userId, p.userId); // fallback to id
  const me = await currentUser();
  return {
    seats: match.seats,
    hostUserId: match.createdBy,
    status: match.status,
    players: players.map((p) => ({ seat: p.seatIndex, name: p.userId === me?.id ? 'You' : (names.get(p.userId) ?? 'Player') })),
  };
}

export async function startGameAction(matchId: string) {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, reason: 'unauthorized' };
  return startGame(getProdDeps(), { matchId, userId });
}
```

Note on names: proper display names require a users-table join. Add `listPlayersWithNames(db, matchId)` to the db layer (join `match_players`→`users`) and use it here for real names. Minimal version above uses id as a placeholder; the reviewer should confirm the join is added:

```ts
// add to lib/db/repositories/players.ts
import { users } from '../schema';
export async function listPlayersWithNames(db: DB, matchId: string): Promise<Array<MatchPlayer & { displayName: string }>> {
  const rows = await db.select({ p: matchPlayers, name: users.displayName })
    .from(matchPlayers).innerJoin(users, eq(users.id, matchPlayers.userId))
    .where(eq(matchPlayers.matchId, matchId)).orderBy(asc(matchPlayers.seatIndex));
  return rows.map((r) => ({ ...r.p, displayName: r.name }));
}
```
Use `listPlayersWithNames` in `getLobbyState` for `name` (viewer → 'You').

```tsx
// app/match/[id]/lobby/WaitingRoom.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLobbyState, startGameAction, type LobbyState } from '../../../actions/match';
import { TableShape } from '../../../../lib/ui/TableShape';
import { PlaceCard } from '../../../../lib/ui/PlaceCard';
import { LampButton } from '../../../../lib/ui/LampButton';

export function WaitingRoom({ matchId, joinCode, viewerId, initial }:
  { matchId: string; joinCode: string; viewerId: string; initial: LobbyState }) {
  const router = useRouter();
  const [state, setState] = useState<LobbyState>(initial);

  useEffect(() => {
    const es = new EventSource(`/api/matches/${matchId}/stream`);
    const refresh = async () => {
      const s = await getLobbyState(matchId);
      setState(s);
      if (s.status === 'active') { es.close(); router.push(`/match/${matchId}/table`); }
    };
    es.onmessage = refresh;
    return () => es.close();
  }, [matchId, router]);

  const bySeat = new Map(state.players.map((p) => [p.seat, p]));
  const full = state.players.length === state.seats;
  const isHost = viewerId === state.hostUserId;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 text-center">
      <div className="inline-block rounded-lg border-2 border-dashed border-brass bg-[linear-gradient(180deg,#f6efd8,#e9dfbe)] px-6 py-3 shadow">
        <div className="text-[10px] uppercase tracking-widest text-[#8a7f5f]">Table code — send it round</div>
        <div className="font-[family-name:var(--font-display)] text-4xl tracking-[.4em] text-maroon">{joinCode}</div>
      </div>

      <div className="mt-6">
        <TableShape seats={state.seats} renderSeat={(seat) => {
          const p = bySeat.get(seat);
          return p ? <PlaceCard name={p.name} host={false} /> : <PlaceCard empty />;
        }} />
      </div>

      <div className="mt-4 text-bone">{state.players.length} of {state.seats} seated</div>
      {isHost && (
        <div className="mt-3">
          <LampButton disabled={!full} onClick={async () => { const r = await startGameAction(matchId); if (r.ok) router.push(`/match/${matchId}/table`); }}>
            {full ? 'Deal ▸' : 'Deal ▸ (waiting for a full table)'}
          </LampButton>
        </div>
      )}
    </div>
  );
}
```

```tsx
// app/match/[id]/lobby/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, getMatch } from '../../../../lib/db';
import { getLobbyState } from '../../../actions/match';
import { RoomBackdrop } from '../../../../lib/ui/RoomBackdrop';
import { WaitingRoom } from './WaitingRoom';

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const { id } = await params;
  const match = await getMatch(db, id);
  if (!match) redirect('/');
  if (match.status === 'active') redirect(`/match/${id}/table`);
  const initial = await getLobbyState(id);
  return (
    <RoomBackdrop plate="room-waiting">
      <WaitingRoom matchId={id} joinCode={match.joinCode} viewerId={userId} initial={initial} />
    </RoomBackdrop>
  );
}
```

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run && npx tsc --noEmit && npx next build`
Expected: all green; every route compiles.

- [ ] **Step 5: Commit**

```bash
git add app/match/\[id\]/lobby app/actions/match.ts lib/db/repositories/players.ts lib/ui/__tests__/waiting-room.test.tsx
git commit -m "feat(lobby): live waiting room (SSE fill, adaptive table, deal)"
```

---

## Self-Review Notes (author)

- **Spec coverage:** 2–5 players + 5-deal tests (T1), createLobby 2..5 (T1), randomised seating (T2), Tailwind/tokens/fonts/RTL (T3), TableShape square/pentagon on edges (T4), parlour kit incl. RoomBackdrop plate+fallback (T5), stats + server actions (T6), auth pages + home + route protection + placeholder table (T7), create page (T8), live waiting room via SSE (T9). Art plates consumed by filename per `docs/art-brief.md` with CSS fallback.
- **Known approximation flagged:** name display needs the `listPlayersWithNames` join (added in T9); the first draft of `getLobbyState` shows a placeholder before the join — the task instructs using the join. Reviewer: confirm names resolve, not ids.
- **Placeholder scan:** none of the forbidden patterns. **Type consistency:** `LobbyState`, `SeatPos`, `seatPositions`, `tableKind`, `getUserStats`, `createTableAction`/`joinTableAction`/`startGameAction`, `reseatOne` consistent across tasks.
- **Deferred to Phase 5:** the table/play UI (placeholder route only). **Phase 6:** E2E, Clerk production keys + kortn.com DNS.
- **Ledger-worthy:** `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` must be set in `.env.local` + Vercel for Clerk routing (operational, noted in T7).
