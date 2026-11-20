'use server';
import { auth } from '@clerk/nextjs/server';
import { getProdDeps, submitAction, loadClientView, type ServerAction, type ClientView } from '../../lib/server';
import { db } from '../../lib/db';

export async function playAction(matchId: string, action: ServerAction): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  const res = await submitAction(getProdDeps(), { matchId, userId, action });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

/** Current table for the signed-in player — used to re-sync after a dropped connection. */
export async function getTableView(matchId: string): Promise<ClientView | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return loadClientView(db, matchId, userId);
}
