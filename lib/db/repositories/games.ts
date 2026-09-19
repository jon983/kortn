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
    .returning();
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
