import type { RuntimeDeps, SubmitResult } from './deps';
import {
  upsertUser, addPlayer, listPlayers, getMatch, getMatchByJoinCode,
  updateMatchStatus, updatePlayer, initGameState, reseatOne, abandonMatch, removePlayer, claimForDeal,
  loadGameState, saveGameState, OptimisticLockError,
  createMatch as createMatchRow,
} from '../db';
import { startMatch as engineStartMatch, shuffle } from '../kalooki';

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

async function reseatPlayers(deps: RuntimeDeps, matchId: string, players: { seatIndex: number }[]): Promise<void> {
  const targets = shuffle(players.map((_, i) => i), deps.rng);
  for (let i = 0; i < players.length; i++) await reseatOne(deps.db, matchId, players[i].seatIndex, -(i + 1));
  for (let i = 0; i < players.length; i++) await reseatOne(deps.db, matchId, -(i + 1), targets[i]);
}

export async function startGame(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string },
): Promise<SubmitResult> {
  const match = await getMatch(deps.db, input.matchId);
  if (!match) return { ok: false, reason: 'No such match' };
  if (match.createdBy !== input.userId) return { ok: false, reason: 'Only the creator can start' };
  if (match.status !== 'lobby') return { ok: false, reason: 'Already started' };
  if ((await listPlayers(deps.db, input.matchId)).length !== match.seats) return { ok: false, reason: 'Seats not filled' };

  // Claim the table first (one atomic statement): from here a guest can no longer leave,
  // so the players we read next are exactly the ones who'll be dealt in.
  if (!(await claimForDeal(deps.db, input.matchId))) return { ok: false, reason: 'Already started' };
  const players = await listPlayers(deps.db, input.matchId);
  if (players.length !== match.seats) {
    await updateMatchStatus(deps.db, input.matchId, 'lobby'); // someone left just before the claim
    return { ok: false, reason: 'Seats not filled' };
  }

  for (const p of players) await updatePlayer(deps.db, input.matchId, p.seatIndex, { bitsPaid: 4 });
  await reseatPlayers(deps, input.matchId, players);

  const seed = Math.floor(deps.rng() * 2_147_483_647);
  const state = engineStartMatch({ seats: match.seats, seed });
  await initGameState(deps.db, input.matchId, state);
  await deps.pubsub.publish('match:' + input.matchId, state);
  return { ok: true };
}

/**
 * End a game early (people walked away). Any seated player may do it. The match
 * is marked abandoned: no winner, no pot paid out, and it doesn't count as a
 * game played — only the bits already paid hand-by-hand stand.
 */
export async function endMatch(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string },
): Promise<SubmitResult> {
  const match = await getMatch(deps.db, input.matchId);
  if (!match) return { ok: false, reason: 'No such match' };
  const players = await listPlayers(deps.db, input.matchId);
  if (!players.some((p) => p.userId === input.userId)) return { ok: false, reason: 'Not a player in this match' };
  if (match.status !== 'lobby' && match.status !== 'active') return { ok: false, reason: 'This game is already over' };

  if (match.status === 'lobby') {
    await abandonMatch(deps.db, input.matchId);
    await deps.pubsub.publish('match:' + input.matchId, { type: 'lobby', matchId: input.matchId });
    return { ok: true };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const loaded = await loadGameState(deps.db, input.matchId);
    if (!loaded) break;
    if (loaded.state.finished) return { ok: false, reason: 'This game is already over' };
    const ended = { ...loaded.state, finished: true, winnerSeat: null, abandoned: true };
    try {
      await saveGameState(deps.db, input.matchId, loaded.version, ended);
    } catch (e) {
      if (e instanceof OptimisticLockError) continue;
      throw e;
    }
    await abandonMatch(deps.db, input.matchId);
    await deps.pubsub.publish('match:' + input.matchId, ended);
    return { ok: true };
  }
  return { ok: false, reason: 'conflict' };
}

/** A seated guest leaves a table that hasn't been dealt yet. (The host deletes the table instead.) */
export async function leaveLobby(
  deps: RuntimeDeps,
  input: { matchId: string; userId: string },
): Promise<SubmitResult> {
  const match = await getMatch(deps.db, input.matchId);
  if (!match) return { ok: false, reason: 'No such table' };
  if (match.status !== 'lobby') return { ok: false, reason: 'This table has already been dealt' };
  if (match.createdBy === input.userId) return { ok: false, reason: 'The host can delete the table instead' };
  const players = await listPlayers(deps.db, input.matchId);
  if (!players.some((p) => p.userId === input.userId)) return { ok: false, reason: 'Not seated at this table' };
  if (!(await removePlayer(deps.db, input.matchId, input.userId))) return { ok: false, reason: 'This table has already been dealt' };
  await deps.pubsub.publish('match:' + input.matchId, { type: 'lobby', matchId: input.matchId });
  return { ok: true };
}
