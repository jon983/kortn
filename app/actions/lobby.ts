'use server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getProdDeps, createLobby, joinLobby } from '../../lib/server';

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
