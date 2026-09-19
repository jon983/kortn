import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { matchPlayers, users } from '../schema';

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
): Promise<Array<MatchPlayer & { displayName: string }>> {
  const rows = await db
    .select({ p: matchPlayers, name: users.displayName })
    .from(matchPlayers)
    .innerJoin(users, eq(users.id, matchPlayers.userId))
    .where(eq(matchPlayers.matchId, matchId))
    .orderBy(asc(matchPlayers.seatIndex));
  return rows.map((r) => ({ ...r.p, displayName: r.name }));
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
