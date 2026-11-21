import type { DB } from '../db';
import { getMatch } from '../db';
import { resolveSeat } from './seats';
import { roomNameFor, type DailyClient } from './daily';
import { seatUserId } from '../call-ids';

const TOKEN_TTL_S = 6 * 60 * 60;

export type CallCredentials = { ok: true; url: string; token: string } | { ok: false; reason: string };

/** A join pass for this game's video call — only for players seated in a game in play. */
export async function getCallCredentials(
  deps: { db: DB; daily: DailyClient; now?: () => number },
  input: { matchId: string; userId: string; displayName: string },
): Promise<CallCredentials> {
  const match = await getMatch(deps.db, input.matchId);
  if (!match) return { ok: false, reason: 'No such game' };
  if (match.status !== 'active') return { ok: false, reason: 'This game isn’t in play' };
  const seat = await resolveSeat(deps.db, input.matchId, input.userId);
  if (seat === null) return { ok: false, reason: 'Not a player in this game' };

  const room = await deps.daily.getOrCreateRoom(roomNameFor(input.matchId));
  const nowS = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  const token = await deps.daily.createToken({
    roomName: room.name,
    userId: seatUserId(seat),
    userName: input.displayName,
    exp: nowS + TOKEN_TTL_S,
  });
  return { ok: true, url: room.url, token };
}
