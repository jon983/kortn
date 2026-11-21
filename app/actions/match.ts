'use server';
import { auth } from '@clerk/nextjs/server';
import { getProdDeps, startGame } from '../../lib/server';

export async function startGameAction(matchId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  return startGame(getProdDeps(), { matchId, userId });
}
