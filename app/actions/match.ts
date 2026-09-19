'use server';
import { auth } from '@clerk/nextjs/server';
import { getProdDeps, startGame } from '../../lib/server';
import { db, getMatch, listPlayersWithNames } from '../../lib/db';

export type LobbyState = {
  seats: number;
  hostUserId: string;
  status: string;
  players: { seat: number; name: string }[];
};

export async function getLobbyState(matchId: string): Promise<LobbyState> {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');
  const match = await getMatch(db, matchId);
  if (!match) throw new Error('No such match');
  const players = await listPlayersWithNames(db, matchId);
  if (!players.some((p) => p.userId === userId)) throw new Error('forbidden');
  return {
    seats: match.seats,
    hostUserId: match.createdBy,
    status: match.status,
    players: players.map((p) => ({
      seat: p.seatIndex,
      name: p.userId === userId ? 'You' : p.displayName,
    })),
  };
}

export async function startGameAction(matchId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'unauthorized' };
  return startGame(getProdDeps(), { matchId, userId });
}
