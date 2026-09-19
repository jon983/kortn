import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { finishRoundTransition, submitAction } from '../runtime';
import { upsertUser, createMatch, addPlayer, initGameState, loadGameState, recordRound as _rr } from '../../db';
import { users } from '../../db/schema';
import { startMatch, makeRng, type MatchState } from '../../kalooki';

function mkDeps(db: any) { return { db, pubsub: new InMemoryPubSub(), rng: makeRng(7) }; }
let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

// Build a finished-round MatchState: seat 0 went out (empty hand), seat 1 holds cards.
function finishedRoundState(): MatchState {
  const s = startMatch({ seats: 2, seed: 1 });
  const round = {
    ...s.round,
    players: [
      { seat: 0, hand: [], hasOpened: true },
      { seat: 1, hand: [{ id: 'A-clubs-9', kind: 'natural', rank: 9, suit: 'clubs', pack: 'A' } as any], hasOpened: true },
    ],
    finished: true, winnerSeat: 0, goOutType: 'normal' as const,
    turnStartHandSize: 2, openedAtTurnStart: true,
  };
  return { ...s, round };
}

describe('finishRoundTransition', () => {
  it('settles a normal round, records it, and deals the next round', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T1' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    const state = finishedRoundState();
    await initGameState(db as any, m.id, state);

    const next = await finishRoundTransition(d, m.id, state);
    // seat 1 held a 9 → +9; seat 0 (winner) 0
    expect(next.scores).toEqual([0, 9]);
    expect(next.roundNumber).toBe(2);            // next round dealt
    expect(next.round.players[0].hand).toHaveLength(13);
    expect(next.finished).toBe(false);
    const persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.roundNumber).toBe(2);
  });

  it('ends the match when only one player remains under 150', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T2' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    // seat 1 already at 145, will bust with +9 -> 154 > 150
    const state = finishedRoundState();
    state.scores = [0, 145];
    await initGameState(db as any, m.id, state);

    const done = await finishRoundTransition(d, m.id, state);
    expect(done.finished).toBe(true);
    expect(done.winnerSeat).toBe(0);
  });

  it('all-decline match-end awards gamesPlayed to every player', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T3' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    // seat 1 is already busted and has not yet decided; seat 0 stays active.
    const base = startMatch({ seats: 2, seed: 1 });
    const state: MatchState = {
      ...base,
      statuses: ['active', 'busted'],
      rebought: [false, false],
      scores: [0, 154],
    };
    await initGameState(db as any, m.id, state);

    // seat 1's user declines -> no seat pending -> only seat 0 active -> match ends
    const res = await submitAction(d, { matchId: m.id, userId: 'u2', action: { type: 'decline' } });
    expect(res.ok).toBe(true);

    const persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.finished).toBe(true);
    expect(persisted!.state.winnerSeat).toBe(0);

    const [u1] = await db.select().from(users).where(eq(users.id, 'u1'));
    const [u2] = await db.select().from(users).where(eq(users.id, 'u2'));
    expect(u1.gamesPlayed).toBe(1);
    expect(u2.gamesPlayed).toBe(1);
  });
});
