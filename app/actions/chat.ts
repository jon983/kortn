'use server';
import { auth } from '@clerk/nextjs/server';
import { getProdDeps, resolveSeat } from '../../lib/server';
import { db, addChatMessage } from '../../lib/db';

const MAX_LEN = 300;

export async function sendChatAction(
  matchId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  const text = body.trim().slice(0, MAX_LEN);
  if (!text) return { ok: false, reason: 'Empty message' };

  const seat = await resolveSeat(db, matchId, userId);
  if (seat === null) return { ok: false, reason: 'Not a player in this match' };

  const row = await addChatMessage(db, { matchId, userId, seatIndex: seat, body: text });
  const at = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  // Broadcast over the match's existing pub/sub channel; the SSE stream forwards
  // non-state messages untouched and clients pick out `type: 'chat'`.
  await getProdDeps().pubsub.publish('match:' + matchId, { type: 'chat', id: row.id, seat, body: text, at });
  return { ok: true };
}
