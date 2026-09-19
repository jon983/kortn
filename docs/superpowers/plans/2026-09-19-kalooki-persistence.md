# Kalooki Persistence Layer (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Neon-Postgres persistence layer for Kalooki — Drizzle schema for all six tables plus dependency-injected repository functions (users, matches, match_players, rounds, game_states with optimistic locking, moves) — tested hermetically against PGlite.

**Architecture:** Drizzle ORM over Postgres. The authoritative engine state (from `lib/kalooki`) is stored as JSONB in `game_states.state` with an integer `version` for optimistic locking; aggregate/queryable data (scores, statuses, results) is normalized into columns. Repository functions take a `db` handle as their first argument (dependency injection) so the exact same code runs against Neon in production and an in-process PGlite database in tests. Runtime uses `@neondatabase/serverless` (neon-http driver).

**Tech Stack:** TypeScript, Drizzle ORM (`drizzle-orm`, `drizzle-kit`), `@neondatabase/serverless`, PGlite (`@electric-sql/pglite`) for tests, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-kalooki-online-design.md` (Section 4, Data Model)

## Global Constraints

- Name is **Kalooki** everywhere; app/repo is **kortn**.
- Engine types (`MatchState`, `Action`) are imported from `lib/kalooki` (Phase 1, complete). Do NOT redefine them.
- Engine state is stored as **JSONB** (`game_states.state`, `moves.action`), typed via Drizzle `.$type<…>()`. Aggregates (scores, statuses, pot, results) ARE normalized columns.
- **Optimistic locking:** `game_states.version` (integer). `saveGameState` updates only when the stored version equals the expected version, and increments it; a stale version is rejected (0 rows affected → throw `OptimisticLockError`).
- Repository functions are **pure of any global db singleton**: every function takes `db: DB` as its first parameter. The `DB` type is `NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>`.
- Tests are **hermetic**: they run against a fresh PGlite instance migrated from `./drizzle`, never against Neon. No network in tests.
- Timestamps are `timestamp with time zone`, default `now()`.
- All files live under `lib/db/`; tests under `lib/db/__tests__/`. Run tests with `npx vitest run lib/db`; typecheck with `npx tsc --noEmit` (strict; no unused locals/params).
- Migrations live in `./drizzle` and are generated with `npx drizzle-kit generate` (dialect postgresql), reading `DATABASE_URL_UNPOOLED` from `.env.local`.

---

## File Structure

- `lib/db/schema.ts` — all tables, enums, and column-JSON types.
- `lib/db/client.ts` — runtime Neon db singleton + exported `DB` union type.
- `lib/db/errors.ts` — `OptimisticLockError`.
- `lib/db/repositories/users.ts` — `upsertUser`.
- `lib/db/repositories/matches.ts` — `createMatch`, `getMatch`, `getMatchByJoinCode`, `listMatchesForUser`, `updateMatchStatus`, `setMatchWinner`.
- `lib/db/repositories/players.ts` — `addPlayer`, `listPlayers`, `updatePlayer`.
- `lib/db/repositories/games.ts` — `initGameState`, `loadGameState`, `saveGameState`, `appendMove`, `listMoves`.
- `lib/db/repositories/rounds.ts` — `recordRound`.
- `lib/db/index.ts` — barrel re-export.
- `lib/db/__tests__/helpers.ts` — `makeTestDb()` (PGlite + migrate).
- `drizzle.config.ts` — drizzle-kit config (repo root).
- `drizzle/` — generated migrations (committed).

---

## Task 1: Dependencies, drizzle config, client, and PGlite test helper

**Files:**
- Modify: `package.json` (add deps)
- Create: `drizzle.config.ts`
- Create: `lib/db/schema.ts` (minimal placeholder — one table so config + client compile; full schema in Tasks 2–3)
- Create: `lib/db/client.ts`
- Create: `lib/db/errors.ts`
- Create: `lib/db/__tests__/helpers.ts`
- Test: `lib/db/__tests__/setup.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `DB = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>` (from `client.ts`)
  - `class OptimisticLockError extends Error` (from `errors.ts`)
  - `async function makeTestDb(): Promise<{ db: PgliteDatabase<typeof schema>; client: PGlite }>` (from `helpers.ts`)

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit @electric-sql/pglite dotenv
```
Expected: packages added to `package.json`.

- [ ] **Step 2: Write the failing test**

```ts
// lib/db/__tests__/setup.test.ts
import { describe, it, expect } from 'vitest';
import { makeTestDb } from './helpers';
import { OptimisticLockError } from '../errors';

describe('db setup', () => {
  it('creates a migrated in-memory PGlite database', async () => {
    const { db, client } = await makeTestDb();
    // A trivial query proves the connection + at least one migrated table exist.
    const rows = await db.execute('select 1 as ok');
    expect(rows.rows[0]).toEqual({ ok: 1 });
    await client.close();
  });

  it('exposes OptimisticLockError', () => {
    const e = new OptimisticLockError('stale');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('OptimisticLockError');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/setup.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write minimal implementations**

```ts
// lib/db/schema.ts  (placeholder — replaced/extended in Tasks 2–3)
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
// lib/db/errors.ts
export class OptimisticLockError extends Error {
  constructor(message = 'Optimistic lock conflict') {
    super(message);
    this.name = 'OptimisticLockError';
  }
}
```

```ts
// lib/db/client.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';

// Runtime handle (Neon HTTP). Not used in tests.
const connectionString = process.env.DATABASE_URL;
export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : (undefined as unknown as NeonHttpDatabase<typeof schema>);

// The union both drivers satisfy — every repository takes this as its first arg.
export type DB = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;
```

```ts
// lib/db/__tests__/helpers.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../schema';

export async function makeTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return { db, client };
}
```

```ts
// drizzle.config.ts
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
});
```

- [ ] **Step 5: Generate the initial migration (so PGlite has a table to migrate)**

Run:
```bash
npx drizzle-kit generate --name init
```
Expected: creates `drizzle/0000_*.sql` + `drizzle/meta/*`. (This migration only has the placeholder `users` table for now; Tasks 2–3 regenerate it.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/setup.test.ts && npx tsc --noEmit`
Expected: PASS, zero type errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts lib/db drizzle
git commit -m "feat(db): drizzle+neon setup, pglite test harness, optimistic-lock error"
```

---

## Task 2: Schema — enums, users, matches, match_players

**Files:**
- Modify: `lib/db/schema.ts` (replace placeholder users with full schema for these three tables + enums)
- Test: `lib/db/__tests__/schema-core.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `schema.ts`):
  - Enums: `matchStatusEnum` (`lobby|active|finished|abandoned`), `seatStatusEnum` (`active|busted|left`), `goOutTypeEnum` (`normal|kalooki|treasure`).
  - `users` (`id` text PK = Clerk id, `displayName`, `avatarUrl?`, `gamesPlayed`, `roundsWon`, `bitsNet`, `createdAt`, `updatedAt`).
  - `matches` (`id` uuid PK, `status`, `createdBy`→users, `seats`, `pot`, `settings` jsonb, `joinCode` unique, `winnerUserId?`→users, `createdAt`, `finishedAt?`).
  - `matchPlayers` (composite PK `[matchId, seatIndex]`; `userId`→users, `score`, `bitsPaid`, `rebought`, `status`, `finalPlacing?`).
  - `type MatchSettings = { note?: string }` (minimal, extensible).

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/schema-core.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { users, matches, matchPlayers } from '../schema';
import { eq } from 'drizzle-orm';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('core schema', () => {
  it('inserts a user, a match, and a match_player with a composite key', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();

    await db.insert(users).values({ id: 'u1', displayName: 'Alice' });
    const [m] = await db.insert(matches).values({
      createdBy: 'u1', seats: 2, joinCode: 'ABCD',
    }).returning();
    expect(m.status).toBe('lobby');
    expect(m.pot).toBe(0);

    await db.insert(matchPlayers).values({ matchId: m.id, userId: 'u1', seatIndex: 0 });
    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, m.id));
    expect(players).toHaveLength(1);
    expect(players[0].status).toBe('active');
    expect(players[0].score).toBe(0);
  });

  it('enforces unique joinCode', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await db.insert(users).values({ id: 'u1', displayName: 'Alice' });
    await db.insert(matches).values({ createdBy: 'u1', seats: 2, joinCode: 'DUPE' });
    await expect(
      db.insert(matches).values({ createdBy: 'u1', seats: 2, joinCode: 'DUPE' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/schema-core.test.ts`
Expected: FAIL — `matches`/`matchPlayers` not exported (and migration lacks the tables).

- [ ] **Step 3: Write the schema**

```ts
// lib/db/schema.ts  (replace the whole file)
import {
  pgTable, pgEnum, text, integer, boolean, timestamp, uuid, jsonb, primaryKey,
} from 'drizzle-orm/pg-core';

export type MatchSettings = { note?: string };

export const matchStatusEnum = pgEnum('match_status', ['lobby', 'active', 'finished', 'abandoned']);
export const seatStatusEnum = pgEnum('seat_status', ['active', 'busted', 'left']);
export const goOutTypeEnum = pgEnum('go_out_type', ['normal', 'kalooki', 'treasure']);

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user id
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  gamesPlayed: integer('games_played').notNull().default(0),
  roundsWon: integer('rounds_won').notNull().default(0),
  bitsNet: integer('bits_net').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: matchStatusEnum('status').notNull().default('lobby'),
  createdBy: text('created_by').notNull().references(() => users.id),
  seats: integer('seats').notNull(),
  pot: integer('pot').notNull().default(0),
  settings: jsonb('settings').$type<MatchSettings>().notNull().default({}),
  joinCode: text('join_code').notNull().unique(),
  winnerUserId: text('winner_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const matchPlayers = pgTable('match_players', {
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  seatIndex: integer('seat_index').notNull(),
  score: integer('score').notNull().default(0),
  bitsPaid: integer('bits_paid').notNull().default(0),
  rebought: boolean('rebought').notNull().default(false),
  status: seatStatusEnum('status').notNull().default('active'),
  finalPlacing: integer('final_placing'),
}, (t) => ({
  pk: primaryKey({ columns: [t.matchId, t.seatIndex] }),
}));
```

- [ ] **Step 4: Regenerate migrations**

Run:
```bash
rm -rf drizzle && npx drizzle-kit generate --name init
```
(Regenerating from scratch is safe — nothing has been migrated to Neon yet. This produces one clean `0000_*.sql` with the current schema.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/schema-core.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/__tests__/schema-core.test.ts drizzle
git commit -m "feat(db): users, matches, match_players schema + enums"
```

---

## Task 3: Schema — rounds, game_states, moves (engine JSONB)

**Files:**
- Modify: `lib/db/schema.ts` (append three tables)
- Test: `lib/db/__tests__/schema-game.test.ts`

**Interfaces:**
- Consumes: `MatchState`, `Action` from `lib/kalooki` (Phase 1). Import via `import type { MatchState, Action } from '../kalooki'` (or the package path `@/lib/kalooki`; use the relative path `../kalooki` from `lib/db/schema.ts`).
- Produces (from `schema.ts`):
  - `rounds` (`id` uuid PK, `matchId`→matches cascade, `roundNumber`, `dealerSeat`, `winnerSeat?`, `goOutType?`, `scores?` jsonb `number[]`, `finishedAt?`; unique `[matchId, roundNumber]`).
  - `gameStates` (`matchId` uuid PK →matches cascade, `state` jsonb `MatchState`, `version` integer default 0, `updatedAt`).
  - `moves` (`id` uuid PK, `matchId`→matches cascade, `roundNumber`, `seatIndex`, `sequence`, `action` jsonb `Action`, `createdAt`; unique `[matchId, sequence]`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/schema-game.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { users, matches, gameStates, moves, rounds } from '../schema';
import { eq } from 'drizzle-orm';
import { startMatch } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seedMatch(db: any) {
  await db.insert(users).values({ id: 'u1', displayName: 'A' });
  const [m] = await db.insert(matches).values({ createdBy: 'u1', seats: 2, joinCode: 'JC01' }).returning();
  return m.id as string;
}

describe('game schema', () => {
  it('stores a full engine MatchState as jsonb and reads it back intact', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seedMatch(db);

    const state = startMatch({ seats: 2, seed: 7 });
    await db.insert(gameStates).values({ matchId, state, version: 0 });

    const [row] = await db.select().from(gameStates).where(eq(gameStates.matchId, matchId));
    expect(row.version).toBe(0);
    expect(row.state.seats).toBe(2);
    expect(row.state.round.players).toHaveLength(2);
    // round-trip fidelity of a nested field
    expect(row.state.round.players[0].hand).toHaveLength(13);
  });

  it('stores a move with a jsonb action and enforces unique sequence', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seedMatch(db);

    await db.insert(moves).values({
      matchId, roundNumber: 1, seatIndex: 0, sequence: 1,
      action: { type: 'draw', source: 'stock' },
    });
    const rows = await db.select().from(moves).where(eq(moves.matchId, matchId));
    expect(rows[0].action).toEqual({ type: 'draw', source: 'stock' });
    await expect(
      db.insert(moves).values({ matchId, roundNumber: 1, seatIndex: 1, sequence: 1, action: { type: 'draw', source: 'stock' } }),
    ).rejects.toThrow();
  });

  it('records a round with a unique (matchId, roundNumber)', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seedMatch(db);
    await db.insert(rounds).values({ matchId, roundNumber: 1, dealerSeat: 0, winnerSeat: 1, goOutType: 'normal', scores: [0, 19] });
    const [r] = await db.select().from(rounds).where(eq(rounds.matchId, matchId));
    expect(r.scores).toEqual([0, 19]);
    expect(r.goOutType).toBe('normal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/schema-game.test.ts`
Expected: FAIL — `gameStates`/`moves`/`rounds` not exported.

- [ ] **Step 3: Append to the schema**

```ts
// append to lib/db/schema.ts
import { uniqueIndex } from 'drizzle-orm/pg-core';
import type { MatchState, Action } from '../kalooki';

export const rounds = pgTable('rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  dealerSeat: integer('dealer_seat').notNull(),
  winnerSeat: integer('winner_seat'),
  goOutType: goOutTypeEnum('go_out_type'),
  scores: jsonb('scores').$type<number[]>(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uqRound: uniqueIndex('rounds_match_number_uq').on(t.matchId, t.roundNumber),
}));

export const gameStates = pgTable('game_states', {
  matchId: uuid('match_id').primaryKey().references(() => matches.id, { onDelete: 'cascade' }),
  state: jsonb('state').$type<MatchState>().notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moves = pgTable('moves', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  seatIndex: integer('seat_index').notNull(),
  sequence: integer('sequence').notNull(),
  action: jsonb('action').$type<Action>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqSeq: uniqueIndex('moves_match_sequence_uq').on(t.matchId, t.sequence),
}));
```

Note: consolidate the `uniqueIndex` import into the existing top import line from `drizzle-orm/pg-core` rather than a second import statement, to satisfy `noDuplicateImports`/lint cleanliness.

- [ ] **Step 4: Regenerate migrations**

Run:
```bash
rm -rf drizzle && npx drizzle-kit generate --name init
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/db && npx tsc --noEmit`
Expected: PASS (all db tests), zero type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/__tests__/schema-game.test.ts drizzle
git commit -m "feat(db): rounds, game_states (engine jsonb), moves schema"
```

---

## Task 4: Users repository

**Files:**
- Create: `lib/db/repositories/users.ts`
- Test: `lib/db/__tests__/users.repo.test.ts`

**Interfaces:**
- Consumes: `DB` from `client.ts`; `users` from `schema.ts`.
- Produces:
  - `interface UpsertUserInput { id: string; displayName: string; avatarUrl?: string | null }`
  - `async function upsertUser(db: DB, input: UpsertUserInput): Promise<void>` — insert; on conflict (id) update `displayName`, `avatarUrl`, `updatedAt = now()`. Stats columns are NOT touched by upsert.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/users.repo.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('upsertUser', () => {
  it('inserts a new user and updates on conflict without resetting stats', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();

    await upsertUser(db as any, { id: 'u1', displayName: 'Alice' });
    // bump a stat directly to prove upsert doesn't clobber it
    await db.update(users).set({ gamesPlayed: 5 }).where(eq(users.id, 'u1'));

    await upsertUser(db as any, { id: 'u1', displayName: 'Alice Renamed', avatarUrl: 'x.png' });
    const [u] = await db.select().from(users).where(eq(users.id, 'u1'));
    expect(u.displayName).toBe('Alice Renamed');
    expect(u.avatarUrl).toBe('x.png');
    expect(u.gamesPlayed).toBe(5); // untouched
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/users.repo.test.ts`
Expected: FAIL — `upsertUser` undefined.

- [ ] **Step 3: Write the repository**

```ts
// lib/db/repositories/users.ts
import { sql } from 'drizzle-orm';
import type { DB } from '../client';
import { users } from '../schema';

export interface UpsertUserInput {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export async function upsertUser(db: DB, input: UpsertUserInput): Promise<void> {
  await db
    .insert(users)
    .values({ id: input.id, displayName: input.displayName, avatarUrl: input.avatarUrl ?? null })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? null,
        updatedAt: sql`now()`,
      },
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/users.repo.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repositories/users.ts lib/db/__tests__/users.repo.test.ts
git commit -m "feat(db): users repository (upsertUser)"
```

---

## Task 5: Matches repository

**Files:**
- Create: `lib/db/repositories/matches.ts`
- Test: `lib/db/__tests__/matches.repo.test.ts`

**Interfaces:**
- Consumes: `DB`; `matches`, `matchPlayers`, `users`, `MatchSettings` from schema. `upsertUser` (test only).
- Produces:
  - `interface CreateMatchInput { createdBy: string; seats: number; joinCode: string; settings?: MatchSettings }`
  - `async function createMatch(db: DB, input: CreateMatchInput): Promise<Match>` (returns the inserted row; `Match = typeof matches.$inferSelect`).
  - `async function getMatch(db: DB, id: string): Promise<Match | null>`
  - `async function getMatchByJoinCode(db: DB, joinCode: string): Promise<Match | null>`
  - `async function listMatchesForUser(db: DB, userId: string): Promise<Match[]>` — matches where the user holds a seat, newest first.
  - `async function updateMatchStatus(db: DB, id: string, status: Match['status']): Promise<void>`
  - `async function setMatchWinner(db: DB, id: string, winnerUserId: string): Promise<void>` — sets `winnerUserId`, `status='finished'`, `finishedAt=now()`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/matches.repo.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import {
  createMatch, getMatch, getMatchByJoinCode, listMatchesForUser, updateMatchStatus, setMatchWinner,
} from '../repositories/matches';
import { matchPlayers } from '../schema';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('matches repository', () => {
  it('creates and fetches a match by id and join code', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });

    const m = await createMatch(db as any, { createdBy: 'u1', seats: 3, joinCode: 'CODE1' });
    expect(m.status).toBe('lobby');
    expect(m.seats).toBe(3);

    expect((await getMatch(db as any, m.id))?.id).toBe(m.id);
    expect((await getMatchByJoinCode(db as any, 'CODE1'))?.id).toBe(m.id);
    expect(await getMatch(db as any, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('lists matches where a user holds a seat', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'CODE2' });
    await db.insert(matchPlayers).values({ matchId: m.id, userId: 'u2', seatIndex: 0 });

    const forU2 = await listMatchesForUser(db as any, 'u2');
    expect(forU2.map((x) => x.id)).toContain(m.id);
    const forU1 = await listMatchesForUser(db as any, 'u1');
    expect(forU1).toHaveLength(0); // u1 created it but holds no seat
  });

  it('updates status and sets the winner', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'CODE3' });

    await updateMatchStatus(db as any, m.id, 'active');
    expect((await getMatch(db as any, m.id))?.status).toBe('active');

    await setMatchWinner(db as any, m.id, 'u1');
    const done = await getMatch(db as any, m.id);
    expect(done?.status).toBe('finished');
    expect(done?.winnerUserId).toBe('u1');
    expect(done?.finishedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/matches.repo.test.ts`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Write the repository**

```ts
// lib/db/repositories/matches.ts
import { and, desc, eq, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { matches, matchPlayers, type MatchSettings } from '../schema';

export type Match = typeof matches.$inferSelect;

export interface CreateMatchInput {
  createdBy: string;
  seats: number;
  joinCode: string;
  settings?: MatchSettings;
}

export async function createMatch(db: DB, input: CreateMatchInput): Promise<Match> {
  const [row] = await db
    .insert(matches)
    .values({
      createdBy: input.createdBy,
      seats: input.seats,
      joinCode: input.joinCode,
      settings: input.settings ?? {},
    })
    .returning();
  return row;
}

export async function getMatch(db: DB, id: string): Promise<Match | null> {
  const [row] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return row ?? null;
}

export async function getMatchByJoinCode(db: DB, joinCode: string): Promise<Match | null> {
  const [row] = await db.select().from(matches).where(eq(matches.joinCode, joinCode)).limit(1);
  return row ?? null;
}

export async function listMatchesForUser(db: DB, userId: string): Promise<Match[]> {
  const rows = await db
    .select({ match: matches })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(eq(matchPlayers.userId, userId))
    .orderBy(desc(matches.createdAt));
  return rows.map((r) => r.match);
}

export async function updateMatchStatus(db: DB, id: string, status: Match['status']): Promise<void> {
  await db.update(matches).set({ status }).where(eq(matches.id, id));
}

export async function setMatchWinner(db: DB, id: string, winnerUserId: string): Promise<void> {
  await db
    .update(matches)
    .set({ winnerUserId, status: 'finished', finishedAt: sql`now()` })
    .where(and(eq(matches.id, id)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/matches.repo.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repositories/matches.ts lib/db/__tests__/matches.repo.test.ts
git commit -m "feat(db): matches repository (create/get/list/status/winner)"
```

---

## Task 6: Match-players repository

**Files:**
- Create: `lib/db/repositories/players.ts`
- Test: `lib/db/__tests__/players.repo.test.ts`

**Interfaces:**
- Consumes: `DB`; `matchPlayers` from schema; `createMatch`/`upsertUser` (test only).
- Produces:
  - `type MatchPlayer = typeof matchPlayers.$inferSelect`
  - `interface AddPlayerInput { matchId: string; userId: string; seatIndex: number }`
  - `async function addPlayer(db: DB, input: AddPlayerInput): Promise<MatchPlayer>`
  - `async function listPlayers(db: DB, matchId: string): Promise<MatchPlayer[]>` — ordered by `seatIndex` asc.
  - `interface UpdatePlayerFields { score?: number; bitsPaid?: number; rebought?: boolean; status?: MatchPlayer['status']; finalPlacing?: number | null }`
  - `async function updatePlayer(db: DB, matchId: string, seatIndex: number, fields: UpdatePlayerFields): Promise<void>` — updates only provided fields (no-op if `fields` is empty).

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/players.repo.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { createMatch } from '../repositories/matches';
import { addPlayer, listPlayers, updatePlayer } from '../repositories/players';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seed(db: any) {
  await upsertUser(db, { id: 'u1', displayName: 'A' });
  await upsertUser(db, { id: 'u2', displayName: 'B' });
  const m = await createMatch(db, { createdBy: 'u1', seats: 2, joinCode: 'P1' });
  return m.id as string;
}

describe('players repository', () => {
  it('adds players and lists them ordered by seat', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    await addPlayer(db as any, { matchId, userId: 'u2', seatIndex: 1 });
    await addPlayer(db as any, { matchId, userId: 'u1', seatIndex: 0 });
    const players = await listPlayers(db as any, matchId);
    expect(players.map((p) => p.seatIndex)).toEqual([0, 1]);
    expect(players[0].userId).toBe('u1');
  });

  it('updates only the provided fields', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    await addPlayer(db as any, { matchId, userId: 'u1', seatIndex: 0 });
    await updatePlayer(db as any, matchId, 0, { score: 42, status: 'busted' });
    const [p] = await listPlayers(db as any, matchId);
    expect(p.score).toBe(42);
    expect(p.status).toBe('busted');
    expect(p.rebought).toBe(false); // untouched
    // empty update is a no-op and must not throw
    await updatePlayer(db as any, matchId, 0, {});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/players.repo.test.ts`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Write the repository**

```ts
// lib/db/repositories/players.ts
import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { matchPlayers } from '../schema';

export type MatchPlayer = typeof matchPlayers.$inferSelect;

export interface AddPlayerInput {
  matchId: string;
  userId: string;
  seatIndex: number;
}

export async function addPlayer(db: DB, input: AddPlayerInput): Promise<MatchPlayer> {
  const [row] = await db.insert(matchPlayers).values(input).returning();
  return row;
}

export async function listPlayers(db: DB, matchId: string): Promise<MatchPlayer[]> {
  return db
    .select()
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId))
    .orderBy(asc(matchPlayers.seatIndex));
}

export interface UpdatePlayerFields {
  score?: number;
  bitsPaid?: number;
  rebought?: boolean;
  status?: MatchPlayer['status'];
  finalPlacing?: number | null;
}

export async function updatePlayer(
  db: DB,
  matchId: string,
  seatIndex: number,
  fields: UpdatePlayerFields,
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  await db
    .update(matchPlayers)
    .set(fields)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.seatIndex, seatIndex)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/players.repo.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repositories/players.ts lib/db/__tests__/players.repo.test.ts
git commit -m "feat(db): match-players repository (add/list/update)"
```

---

## Task 7: Game-state repository (optimistic locking) + moves

**Files:**
- Create: `lib/db/repositories/games.ts`
- Test: `lib/db/__tests__/games.repo.test.ts`

**Interfaces:**
- Consumes: `DB`; `gameStates`, `moves` from schema; `OptimisticLockError` from `errors.ts`; `MatchState`, `Action` from `lib/kalooki`; `createMatch`/`upsertUser` (test only).
- Produces:
  - `async function initGameState(db: DB, matchId: string, state: MatchState): Promise<void>` — insert `{ matchId, state, version: 0 }`.
  - `async function loadGameState(db: DB, matchId: string): Promise<{ state: MatchState; version: number } | null>`.
  - `async function saveGameState(db: DB, matchId: string, expectedVersion: number, state: MatchState): Promise<number>` — conditional update `WHERE matchId AND version = expectedVersion`, `SET state, version = expectedVersion + 1, updatedAt = now()`, `RETURNING version`. If no row returned → throw `OptimisticLockError`. Returns the new version.
  - `interface AppendMoveInput { matchId: string; roundNumber: number; seatIndex: number; sequence: number; action: Action }`
  - `async function appendMove(db: DB, input: AppendMoveInput): Promise<void>`.
  - `async function listMoves(db: DB, matchId: string): Promise<Array<typeof moves.$inferSelect>>` — ordered by `sequence` asc.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/games.repo.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { createMatch } from '../repositories/matches';
import { initGameState, loadGameState, saveGameState, appendMove, listMoves } from '../repositories/games';
import { OptimisticLockError } from '../errors';
import { startMatch, applyAction, makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seed(db: any) {
  await upsertUser(db, { id: 'u1', displayName: 'A' });
  const m = await createMatch(db, { createdBy: 'u1', seats: 2, joinCode: 'G1' });
  return m.id as string;
}

describe('game-state repository', () => {
  it('inits, loads, and saves state with an incrementing version', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);

    const s0 = startMatch({ seats: 2, seed: 5 });
    await initGameState(db as any, matchId, s0);

    const loaded = await loadGameState(db as any, matchId);
    expect(loaded?.version).toBe(0);
    expect(loaded?.state.round.players).toHaveLength(2);

    // apply one legal action, then save at the expected version
    const seat = s0.round.turn;
    const res = applyAction(s0, seat, { type: 'draw', source: 'stock' }, makeRng(1));
    if (!res.ok) throw new Error('setup action failed');
    const newVersion = await saveGameState(db as any, matchId, 0, res.match);
    expect(newVersion).toBe(1);
    expect((await loadGameState(db as any, matchId))?.version).toBe(1);
  });

  it('rejects a save at a stale version (optimistic lock)', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    const s0 = startMatch({ seats: 2, seed: 5 });
    await initGameState(db as any, matchId, s0);
    await saveGameState(db as any, matchId, 0, s0); // version -> 1
    await expect(saveGameState(db as any, matchId, 0, s0)).rejects.toBeInstanceOf(OptimisticLockError);
  });

  it('appends moves and lists them in sequence order', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    await appendMove(db as any, { matchId, roundNumber: 1, seatIndex: 0, sequence: 2, action: { type: 'discard', cardId: 'A-clubs-5' } });
    await appendMove(db as any, { matchId, roundNumber: 1, seatIndex: 0, sequence: 1, action: { type: 'draw', source: 'stock' } });
    const rows = await listMoves(db as any, matchId);
    expect(rows.map((r) => r.sequence)).toEqual([1, 2]);
    expect(rows[1].action).toEqual({ type: 'discard', cardId: 'A-clubs-5' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/games.repo.test.ts`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Write the repository**

```ts
// lib/db/repositories/games.ts
import { and, asc, eq, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { gameStates, moves } from '../schema';
import { OptimisticLockError } from '../errors';
import type { MatchState, Action } from '../../kalooki';

export async function initGameState(db: DB, matchId: string, state: MatchState): Promise<void> {
  await db.insert(gameStates).values({ matchId, state, version: 0 });
}

export async function loadGameState(
  db: DB,
  matchId: string,
): Promise<{ state: MatchState; version: number } | null> {
  const [row] = await db.select().from(gameStates).where(eq(gameStates.matchId, matchId)).limit(1);
  return row ? { state: row.state, version: row.version } : null;
}

export async function saveGameState(
  db: DB,
  matchId: string,
  expectedVersion: number,
  state: MatchState,
): Promise<number> {
  const updated = await db
    .update(gameStates)
    .set({ state, version: expectedVersion + 1, updatedAt: sql`now()` })
    .where(and(eq(gameStates.matchId, matchId), eq(gameStates.version, expectedVersion)))
    .returning({ version: gameStates.version });
  if (updated.length === 0) {
    throw new OptimisticLockError(
      `Stale game state for match ${matchId}: expected version ${expectedVersion}`,
    );
  }
  return updated[0].version;
}

export interface AppendMoveInput {
  matchId: string;
  roundNumber: number;
  seatIndex: number;
  sequence: number;
  action: Action;
}

export async function appendMove(db: DB, input: AppendMoveInput): Promise<void> {
  await db.insert(moves).values(input);
}

export async function listMoves(db: DB, matchId: string) {
  return db.select().from(moves).where(eq(moves.matchId, matchId)).orderBy(asc(moves.sequence));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/db/__tests__/games.repo.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repositories/games.ts lib/db/__tests__/games.repo.test.ts
git commit -m "feat(db): game-state repository with optimistic locking + moves"
```

---

## Task 8: Rounds repository + barrel export

**Files:**
- Create: `lib/db/repositories/rounds.ts`
- Create: `lib/db/index.ts`
- Test: `lib/db/__tests__/rounds.repo.test.ts`

**Interfaces:**
- Consumes: `DB`; `rounds` from schema; `GoOutType` from `lib/kalooki` (the union `'normal'|'kalooki'|'treasure'`); `createMatch`/`upsertUser` (test only).
- Produces:
  - `interface RecordRoundInput { matchId: string; roundNumber: number; dealerSeat: number; winnerSeat: number; goOutType: 'normal' | 'kalooki' | 'treasure'; scores: number[] }`
  - `async function recordRound(db: DB, input: RecordRoundInput): Promise<void>`.
  - `lib/db/index.ts` re-exports: `* from './schema'`, `* from './client'`, `* from './errors'`, and everything from each repository file.

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/__tests__/rounds.repo.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { createMatch } from '../repositories/matches';
import { recordRound } from '../repositories/rounds';
import { rounds } from '../schema';
import { eq } from 'drizzle-orm';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('rounds repository', () => {
  it('records a finished round', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'R1' });

    await recordRound(db as any, {
      matchId: m.id, roundNumber: 1, dealerSeat: 0, winnerSeat: 1, goOutType: 'kalooki', scores: [17, 0],
    });
    const [r] = await db.select().from(rounds).where(eq(rounds.matchId, m.id));
    expect(r.winnerSeat).toBe(1);
    expect(r.goOutType).toBe('kalooki');
    expect(r.scores).toEqual([17, 0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/__tests__/rounds.repo.test.ts`
Expected: FAIL — `recordRound` undefined.

- [ ] **Step 3: Write the repository and barrel**

```ts
// lib/db/repositories/rounds.ts
import { sql } from 'drizzle-orm';
import type { DB } from '../client';
import { rounds } from '../schema';

export interface RecordRoundInput {
  matchId: string;
  roundNumber: number;
  dealerSeat: number;
  winnerSeat: number;
  goOutType: 'normal' | 'kalooki' | 'treasure';
  scores: number[];
}

export async function recordRound(db: DB, input: RecordRoundInput): Promise<void> {
  await db.insert(rounds).values({
    matchId: input.matchId,
    roundNumber: input.roundNumber,
    dealerSeat: input.dealerSeat,
    winnerSeat: input.winnerSeat,
    goOutType: input.goOutType,
    scores: input.scores,
    finishedAt: sql`now()`,
  });
}
```

```ts
// lib/db/index.ts
export * from './schema';
export * from './client';
export * from './errors';
export * from './repositories/users';
export * from './repositories/matches';
export * from './repositories/players';
export * from './repositories/games';
export * from './repositories/rounds';
```

- [ ] **Step 4: Run the full db suite and typecheck**

Run: `npx vitest run lib/db && npx tsc --noEmit`
Expected: PASS (all db + engine tests still green), zero type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repositories/rounds.ts lib/db/index.ts lib/db/__tests__/rounds.repo.test.ts
git commit -m "feat(db): rounds repository + db barrel export"
```

---

## Task 9: Push schema to Neon (manual verification gate)

**Files:** none (operational).

This task is a **controller/human-run verification**, not a code change, because it writes to the live Neon database. It is included so the plan's executor stops here rather than pushing silently.

- [ ] **Step 1: Confirm the target database**

Run:
```bash
grep '^DATABASE_URL_UNPOOLED=' .env.local | sed -E 's|.*@([^/?]+).*|\1|'
```
Expected: prints the Neon host (`ep-...neon.tech`). Confirm this is the intended (production, single-branch) Kalooki database before proceeding — this is the documented single-branch setup.

- [ ] **Step 2: Apply migrations to Neon**

Run:
```bash
npx drizzle-kit migrate
```
Expected: applies `drizzle/0000_init.sql` to Neon; the six tables + enums are created. (Uses `DATABASE_URL_UNPOOLED` from `.env.local` per `drizzle.config.ts`.)

- [ ] **Step 3: Verify tables exist**

Run:
```bash
npx drizzle-kit up 2>/dev/null; node -e "import('@neondatabase/serverless').then(async ({neon})=>{const s=neon(process.env.DATABASE_URL_UNPOOLED);const r=await s\`select table_name from information_schema.tables where table_schema='public' order by 1\`;console.log(r.map(x=>x.table_name).join(', '));})" 2>/dev/null || echo "verify via Neon console"
```
Expected: lists `game_states, match_players, matches, moves, rounds, users` (plus drizzle's `__drizzle_migrations`).

- [ ] **Step 4: Commit any migration journal changes**

```bash
git add drizzle
git commit -m "chore(db): apply initial schema migration to Neon" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage (Section 4):** `users` (T2), `matches` (T2), `match_players` (T2), `rounds` (T3/T8), `game_states` with JSONB `state` + `version` optimistic lock (T3/T7), `moves` append-only with `sequence` (T3/T7). JSON-for-engine-state + normalized aggregates: honored. Optimistic locking: T7 with a stale-version rejection test. Resume-after-disconnect relies on `loadGameState` (T7) — provided. Cross-phase note: the server phase consumes these repositories and must honor the engine's documented settle→bust→rebuy→award ordering (carried from Phase 1).
- **DI design:** every repo takes `db: DB` first; tests pass a PGlite drizzle instance (`as any` in tests to bridge the PGlite concrete type to the `DB` union — acceptable in tests; runtime passes the Neon `db`).
- **Known accepted item:** `DB` is a union of the Neon-http and PGlite drizzle types; queries use only the shared builder surface. If a future query needs a driver-specific feature (e.g. real transactions, which neon-http lacks), that becomes a server-phase decision (switch to `neon-serverless` Pool). Not needed for these repositories — optimistic locking uses a single conditional UPDATE, no transaction required.
- **Migrations** are regenerated from scratch in T2/T3 (safe: nothing applied to Neon until T9). T9 is a deliberate human-gated stop before touching the live DB.
- **Placeholder scan:** none. **Type consistency:** `DB`, `Match`, `MatchPlayer`, `OptimisticLockError`, repository signatures consistent across tasks.
