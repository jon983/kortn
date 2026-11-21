import { and, asc, eq, exists } from 'drizzle-orm';
import type { DB } from '../client';
import { matches, matchPlayers, users } from '../schema';

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

export async function reseatOne(db: DB, matchId: string, fromSeat: number, toSeat: number): Promise<void> {
  await db.update(matchPlayers).set({ seatIndex: toSeat })
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.seatIndex, fromSeat)));
}

export async function listPlayersWithNames(
  db: DB,
  matchId: string,
): Promise<Array<MatchPlayer & { displayName: string; avatarUrl: string | null }>> {
  const rows = await db
    .select({ p: matchPlayers, name: users.displayName, avatarUrl: users.avatarUrl })
    .from(matchPlayers)
    .innerJoin(users, eq(users.id, matchPlayers.userId))
    .where(eq(matchPlayers.matchId, matchId))
    .orderBy(asc(matchPlayers.seatIndex));
  return rows.map((r) => ({ ...r.p, displayName: r.name, avatarUrl: r.avatarUrl }));
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

/** Take a player off a table (used before it's dealt). */
/**
 * Remove a player from a table that hasn't been dealt. The status check is part of the
 * delete itself, so it can't race a deal. Returns false when nothing was removed.
 */
export async function removePlayer(db: DB, matchId: string, userId: string): Promise<boolean> {
  const stillOpen = db.select({ id: matches.id }).from(matches).where(and(eq(matches.id, matchId), eq(matches.status, 'lobby')));
  const rows = await db
    .delete(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId), exists(stillOpen)))
    .returning();
  return rows.length > 0;
}
