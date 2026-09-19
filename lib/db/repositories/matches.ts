import { desc, eq, sql } from 'drizzle-orm';
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
    .where(eq(matches.id, id));
}
