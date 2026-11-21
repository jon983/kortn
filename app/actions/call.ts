'use server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '../../lib/db';
import { dailyClient, getCallCredentials, type CallCredentials } from '../../lib/server';

/** Join pass for this game's video call (seated players only). */
export async function joinCallAction(matchId: string): Promise<CallCredentials> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) return { ok: false, reason: 'Video calls aren’t set up yet' };
  const me = await currentUser();
  const displayName = me?.username ?? me?.firstName ?? 'Player';
  try {
    return await getCallCredentials({ db, daily: dailyClient(apiKey) }, { matchId, userId, displayName });
  } catch (e) {
    console.error('joinCallAction', e);
    return { ok: false, reason: 'Couldn’t start the call — try again' };
  }
}
