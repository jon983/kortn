import { and, desc, eq, sql } from 'drizzle-orm';
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

export type MatchListItem = Match & {
  /** Game number: order of creation across all games, so every player sees the same one. */
  number: number;
  /** Last move / state change, else when the game was set up. */
  lastActiveAt: Date;
};

export async function listMatchesForUser(db: DB, userId: string): Promise<MatchListItem[]> {
  const lastActive = sql<Date>`coalesce(${gameStates.updatedAt}, ${matches.createdAt})`;
  const rows = await db
    .select({
      match: matches,
      number: sql<number>`(select count(*) from ${matches} m2 where m2.created_at <= ${matches.createdAt})`,
      lastActiveMs: sql<number>`(extract(epoch from ${lastActive}) * 1000)::bigint`,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .leftJoin(gameStates, eq(gameStates.matchId, matches.id))
    .where(eq(matchPlayers.userId, userId))
    // Most recently active first.
    .orderBy(desc(lastActive));
  return rows.map((r) => ({
    ...r.match,
    number: Number(r.number),
    lastActiveAt: new Date(Number(r.lastActiveMs)),
  }));
}

export async function updateMatchStatus(db: DB, id: string, status: Match['status']): Promise<void> {
  await db.update(matches).set({ status }).where(eq(matches.id, id));
}

/** Atomically move a table from setting-up to dealt; false if it was no longer in the lobby. */
export async function claimForDeal(db: DB, id: string): Promise<boolean> {
  const rows = await db.update(matches).set({ status: 'active' }).where(and(eq(matches.id, id), eq(matches.status, 'lobby'))).returning();
  return rows.length > 0;
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
