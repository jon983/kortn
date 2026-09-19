import type { DB } from '../db';
import { listPlayers } from '../db';

export async function resolveSeat(db: DB, matchId: string, userId: string): Promise<number | null> {
  const players = await listPlayers(db, matchId);
  const found = players.find((p) => p.userId === userId);
  return found ? found.seatIndex : null;
}
