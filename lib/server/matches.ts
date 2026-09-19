import type { RuntimeDeps, SubmitResult } from './deps';
import {
  upsertUser, addPlayer, listPlayers, getMatch, getMatchByJoinCode,
  updateMatchStatus, updatePlayer, initGameState,
  createMatch as createMatchRow,
} from '../db';
import { startMatch as engineStartMatch } from '../kalooki';

function makeJoinCode(rng: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(rng() * alphabet.length)];
  return code;
}

export async function createLobby(
  deps: RuntimeDeps,
  input: { userId: string; displayName: string; seats: number },
): Promise<{ matchId: string; joinCode: string }> {
  if (!Number.isInteger(input.seats) || input.seats < 2 || input.seats > 5) {
    throw new Error('Seats must be between 2 and 5');
  }
  await upsertUser(deps.db, { id: input.userId, displayName: input.displayName });
  const joinCode = makeJoinCode(deps.rng);
  const match = await createMatchRow(deps.db, { createdBy: input.userId, seats: input.seats, joinCode });
  await addPlayer(deps.db, { matchId: match.id, userId: input.userId, seatIndex: 0 });
  return { matchId: match.id, joinCode };
}

export async function joinLobby(
  deps: RuntimeDeps,
  input: { userId: string; displayName: string; joinCode: string },
): Promise<{ matchId: string; seatIndex: number }> {
  await upsertUser(deps.db, { id: input.userId, displayName: input.displayName });
  const match = await getMatchByJoinCode(deps.db, input.joinCode);
  if (!match) throw new Error('No such match');
  if (match.status !== 'lobby') throw new Error('Match already started');
  const players = await listPlayers(deps.db, match.id);
  if (players.some((p) => p.userId === input.userId)) {
    const existing = players.find((p) => p.userId === input.userId)!;
    return { matchId: match.id, seatIndex: existing.seatIndex };
  }
  if (players.length >= match.seats) throw new Error('Match is full');
  const taken = new Set(players.map((p) => p.seatIndex));
  let seatIndex = 0;
  while (taken.has(seatIndex)) seatIndex++;
  await addPlayer(deps.db, { matchId: match.id, userId: input.userId, seatIndex });
  await deps.pubsub.publish('match:' + match.id, { type: 'lobby', matchId: match.id });
  return { matchId: match.id, seatIndex };
}

export async function startGame(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string },
): Promise<SubmitResult> {
  const match = await getMatch(deps.db, input.matchId);
  if (!match) return { ok: false, reason: 'No such match' };
  if (match.createdBy !== input.userId) return { ok: false, reason: 'Only the creator can start' };
  if (match.status !== 'lobby') return { ok: false, reason: 'Already started' };
  const players = await listPlayers(deps.db, input.matchId);
  if (players.length !== match.seats) return { ok: false, reason: 'Seats not filled' };

  const seed = Math.floor(deps.rng() * 2_147_483_647);
  const state = engineStartMatch({ seats: match.seats, seed });
  await initGameState(deps.db, input.matchId, state);
  for (const p of players) await updatePlayer(deps.db, input.matchId, p.seatIndex, { bitsPaid: 4 });
  await updateMatchStatus(deps.db, input.matchId, 'active');
  await deps.pubsub.publish('match:' + input.matchId, state);
  return { ok: true };
}
