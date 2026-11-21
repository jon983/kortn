import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { submitAction } from '../runtime';
import { upsertUser, createMatch, addPlayer, initGameState, loadGameState } from '../../db';
import { startMatch, makeRng, type MatchState } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('the next hand skips players who are out', () => {
  it('deals no cards to an out seat, and the first turn goes to a seat still in', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = { db, pubsub: new InMemoryPubSub(), rng: makeRng(7) };
    for (const id of ['u1', 'u2', 'u3']) await upsertUser(db as any, { id, displayName: id });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 3, joinCode: 'OUT1' });
    for (const [i, id] of ['u1', 'u2', 'u3'].entries()) await addPlayer(db as any, { matchId: m.id, userId: id, seatIndex: i });

    // A settled hand, paused between hands: seat 2 went over 150 and declined to buy back in.
    // Dealer was seat 0, so the next dealer is seat 1 and the seat after it is seat 2 — the one that's out.
    const s = startMatch({ seats: 3, seed: 1 });
    const state: MatchState = {
      ...s,
      scores: [40, 60, 160],
      statuses: ['active', 'active', 'busted'],
      rebought: [false, false, true],
      readyNext: [false, false, true],
      round: { ...s.round, dealerSeat: 0, finished: true, winnerSeat: 0, goOutType: 'normal' },
    };
    await initGameState(db as any, m.id, state);

    await submitAction(d, { matchId: m.id, userId: 'u1', action: { type: 'readyNext' } });
    await submitAction(d, { matchId: m.id, userId: 'u2', action: { type: 'readyNext' } });

    const next = (await loadGameState(db as any, m.id))!.state;
    expect(next.roundNumber).toBe(s.roundNumber + 1);
    expect(next.round.players[0].hand).toHaveLength(13);
    expect(next.round.players[1].hand).toHaveLength(13);
    expect(next.round.players[2].hand).toHaveLength(0);
    expect(next.statuses[next.round.turn]).toBe('active');
  });
});
