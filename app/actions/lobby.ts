'use server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { getProdDeps, createLobby, joinLobby, endMatch, leaveLobby } from '../../lib/server';
import { db, getMatch, deleteMatch } from '../../lib/db';

async function displayName(): Promise<string> {
  const u = await currentUser();
  return u?.username ?? u?.firstName ?? 'Player';
}

export async function createTableAction(formData: FormData): Promise<{ matchId: string; joinCode: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const seats = Number(formData.get('seats'));
  return createLobby(getProdDeps(), { userId, displayName: await displayName(), seats });
}

export async function deleteMatchAction(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const matchId = String(formData.get('matchId') ?? '');
  const match = await getMatch(db, matchId);
  if (!match) return;
  if (match.createdBy !== userId) throw new Error('Only the game’s host can delete it.');
  await deleteMatch(db, matchId);
  revalidatePath('/');
}

export async function joinTableAction(formData: FormData): Promise<{ matchId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const joinCode = String(formData.get('joinCode') ?? '').trim().toUpperCase();
  try {
    const { matchId } = await joinLobby(getProdDeps(), { userId, displayName: await displayName(), joinCode });
    return { matchId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** End a game people walked away from: abandoned, no winner, no pot paid. Any seated player may. */
export async function endGameAction(matchId: string): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  const res = await endMatch(getProdDeps(), { matchId, userId });
  if (res.ok) revalidatePath('/');
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

/** Leave a table that hasn't been dealt (guests only). */
export async function leaveTableAction(matchId: string): Promise<{ ok: boolean; reason?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  const res = await leaveLobby(getProdDeps(), { matchId, userId });
  if (res.ok) revalidatePath('/');
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}
