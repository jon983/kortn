import { desc, eq, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { matches, matchPlayers, gameStates, type MatchSettings } from '../schema';

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
    .leftJoin(gameStates, eq(gameStates.matchId, matches.id))
    .where(eq(matchPlayers.userId, userId))
    // Most recently active first: last move/state change, else when it was set up.
    .orderBy(desc(sql`coalesce(${gameStates.updatedAt}, ${matches.createdAt})`));
  return rows.map((r) => r.match);
}

export async function updateMatchStatus(db: DB, id: string, status: Match['status']): Promise<void> {
  await db.update(matches).set({ status }).where(eq(matches.id, id));
}

export async function deleteMatch(db: DB, id: string): Promise<void> {
  // matchPlayers / gameStates / rounds / moves all cascade on match delete.
  await db.delete(matches).where(eq(matches.id, id));
}

export async function setMatchWinner(db: DB, id: string, winnerUserId: string): Promise<void> {
  await db
    .update(matches)
    .set({ winnerUserId, status: 'finished', finishedAt: sql`now()` })
    .where(eq(matches.id, id));
}

/** Ended early by a player: no winner, nothing paid out. */
export async function abandonMatch(db: DB, id: string): Promise<void> {
  await db
    .update(matches)
    .set({ status: 'abandoned', finishedAt: sql`now()` })
    .where(eq(matches.id, id));
}
