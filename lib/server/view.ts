import type { DB } from '../db';
import { loadGameState, listPlayersWithNames } from '../db';
import { resolveSeat } from './seats';
import { redactStateFor, type ClientView } from './redact';

/** The table as `userId` should see it right now, or null if they aren't seated / no game. */
export async function loadClientView(db: DB, matchId: string, userId: string): Promise<ClientView | null> {
  const seat = await resolveSeat(db, matchId, userId);
  if (seat === null) return null;
  const loaded = await loadGameState(db, matchId);
  if (!loaded) return null;
  const players = await listPlayersWithNames(db, matchId);
  const names: (string | null)[] = [];
  for (const p of players) names[p.seatIndex] = p.displayName;
  return redactStateFor(loaded.state, seat, names);
}
