'use server';
import { auth } from '@clerk/nextjs/server';
import { getProdDeps, submitAction, type ServerAction } from '../../lib/server';

export async function playAction(matchId: string, action: ServerAction): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  const res = await submitAction(getProdDeps(), { matchId, userId, action });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}
