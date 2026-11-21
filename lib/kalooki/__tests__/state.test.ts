import { describe, it, expect } from 'vitest';
import { startMatch, dealRound } from '../state';
import { makeRng } from '../rng';

describe('dealRound', () => {
  it('deals 13 to each seat and seeds stock + discard', () => {
    const r = dealRound({ seats: 4, dealerSeat: 0, rng: makeRng(1) });
    expect(r.players).toHaveLength(4);
    for (const p of r.players) expect(p.hand).toHaveLength(13);
    expect(r.discard).toHaveLength(1);
    // 106 - 4*13 - 1 discard = 53 in stock
    expect(r.stock).toHaveLength(53);
    expect(r.phase).toBe('awaitingDraw');
    expect(r.turn).toBe(1); // eldest hand = left of dealer
  });

  it('no card is lost or duplicated across all zones', () => {
    const r = dealRound({ seats: 2, dealerSeat: 0, rng: makeRng(9) });
    const all = [...r.stock, ...r.discard, ...r.players.flatMap((p) => p.hand)];
    expect(all).toHaveLength(106);
    expect(new Set(all.map((c) => c.id)).size).toBe(106);
  });
});

describe('startMatch', () => {
  it('sets buy-in pot to 4 * seats and zero scores', () => {
    const m = startMatch({ seats: 3, seed: 5 });
    expect(m.pot).toBe(12);
    expect(m.scores).toEqual([0, 0, 0]);
    expect(m.treasureUsed).toBe(false);
    expect(m.round.players).toHaveLength(3);
  });
});

describe('dealRound with players out', () => {
  it('deals only to seats still in, skips an out dealer, and starts with a seat still in', async () => {
    const { dealRound, makeRng } = await import('../index');
    // dealer candidate is seat 1 (out) → dealer moves on to seat 2; first turn wraps past out seat 1 to seat 0
    const r = dealRound({ seats: 4, dealerSeat: 1, rng: makeRng(5), statuses: ['active', 'busted', 'active', 'left'] });
    expect(r.players.map((p) => p.hand.length)).toEqual([13, 0, 13, 0]);
    expect(r.dealerSeat).toBe(2);
    expect(r.turn).toBe(0);
    expect(r.stock.length).toBe(106 - 26 - 1); // two packs + 2 jokers
  });
  it('with everyone in, deals as before', async () => {
    const { dealRound, makeRng } = await import('../index');
    const r = dealRound({ seats: 3, dealerSeat: 1, rng: makeRng(5) });
    expect(r.players.map((p) => p.hand.length)).toEqual([13, 13, 13]);
    expect(r.turn).toBe(2);
  });
});
