import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });
const rng = () => 0.5;

function fixture(meld: { kind: 'run' | 'set'; cards: Card[] }, hand: Card[]): MatchState {
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', ownerSeat: 1, ...meld }],
    stock: [nat(2, 'clubs')], discard: [nat(3, 'clubs')], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

const ids = (cs: Card[]) => cs.map((c) => c.id);

describe('returnJoker — put a reclaimed joker back', () => {
  it('a run: restores the joker in place and returns the natural to hand', () => {
    const m = fixture({ kind: 'run', cards: [nat(4, 'hearts', 'B'), joker(), nat(6, 'hearts', 'B')] }, [nat(5, 'hearts'), nat(8, 'spades')]);
    const r1 = applyAction(m, 0, { type: 'layoff', cardIds: ['A-hearts-5'], meldId: 'm1-0' }, rng);
    if (!r1.ok) throw new Error(r1.reason);
    const r2 = applyAction(r1.match, 0, { type: 'returnJoker' }, rng);
    if (!r2.ok) throw new Error(r2.reason);
    expect(ids(r2.match.round.melds[0].cards)).toEqual(['B-hearts-4', 'A-joker', 'B-hearts-6']);
    expect(ids(r2.match.round.players[0].hand).sort()).toEqual(['A-hearts-5', 'A-spades-8']);
    expect(r2.match.round.jokerObligation ?? []).toEqual([]);
    // and the turn can now end normally
    const r3 = applyAction(r2.match, 0, { type: 'discard', cardId: 'A-spades-8' }, rng);
    expect(r3.ok).toBe(true);
  });

  it('a run extended after the retrieval: joker goes back into the natural’s slot', () => {
    const m = fixture({ kind: 'run', cards: [nat(4, 'hearts', 'B'), joker(), nat(6, 'hearts', 'B')] }, [nat(5, 'hearts'), nat(7, 'hearts'), nat(8, 'spades')]);
    const r1 = applyAction(m, 0, { type: 'layoff', cardIds: ['A-hearts-5'], meldId: 'm1-0' }, rng);
    if (!r1.ok) throw new Error(r1.reason);
    const r2 = applyAction(r1.match, 0, { type: 'layoff', cardIds: ['A-hearts-7'], meldId: 'm1-0' }, rng);
    if (!r2.ok) throw new Error(r2.reason);
    const r3 = applyAction(r2.match, 0, { type: 'returnJoker' }, rng);
    if (!r3.ok) throw new Error(r3.reason);
    expect(ids(r3.match.round.melds[0].cards)).toEqual(['B-hearts-4', 'A-joker', 'B-hearts-6', 'A-hearts-7']);
    expect(ids(r3.match.round.players[0].hand).sort()).toEqual(['A-hearts-5', 'A-spades-8']);
  });

  it('a set: removes both laid-off naturals and restores the original set', () => {
    const m = fixture({ kind: 'set', cards: [nat(9, 'clubs', 'B'), nat(9, 'hearts', 'B'), joker()] }, [nat(9, 'diamonds'), nat(9, 'spades'), nat(2, 'hearts')]);
    const r1 = applyAction(m, 0, { type: 'layoff', cardIds: ['A-diamonds-9', 'A-spades-9'], meldId: 'm1-0' }, rng);
    if (!r1.ok) throw new Error(r1.reason);
    const r2 = applyAction(r1.match, 0, { type: 'returnJoker' }, rng);
    if (!r2.ok) throw new Error(r2.reason);
    expect(ids(r2.match.round.melds[0].cards)).toEqual(['B-clubs-9', 'B-hearts-9', 'A-joker']);
    expect(ids(r2.match.round.players[0].hand).sort()).toEqual(['A-diamonds-9', 'A-hearts-2', 'A-spades-9']);
  });

  it('is refused when there is no reclaimed joker in hand', () => {
    const m = fixture({ kind: 'run', cards: [nat(4, 'hearts', 'B'), nat(5, 'hearts', 'B'), nat(6, 'hearts', 'B')] }, [joker(), nat(8, 'spades')]);
    const r = applyAction(m, 0, { type: 'returnJoker' }, rng);
    expect(r.ok).toBe(false);
  });

  it('only returns jokers still in hand (one already melded stays melded)', () => {
    // Two runs each holding a joker; reclaim both, meld one, return the other.
    const m = fixture({ kind: 'run', cards: [nat(4, 'hearts', 'B'), joker(), nat(6, 'hearts', 'B')] }, [
      nat(5, 'hearts'), nat(5, 'spades'), nat(10, 'clubs'), nat(10, 'diamonds'), nat(8, 'spades'),
    ]);
    m.round.melds.push({ id: 'm1-1', ownerSeat: 1, kind: 'run', cards: [nat(4, 'spades', 'B'), joker('B'), nat(6, 'spades', 'B')] });
    const r1 = applyAction(m, 0, { type: 'layoff', cardIds: ['A-hearts-5'], meldId: 'm1-0' }, rng);
    if (!r1.ok) throw new Error(r1.reason);
    const r2 = applyAction(r1.match, 0, { type: 'layoff', cardIds: ['A-spades-5'], meldId: 'm1-1' }, rng);
    if (!r2.ok) throw new Error(r2.reason);
    const r3 = applyAction(r2.match, 0, { type: 'meld', groups: [{ kind: 'set', cardIds: ['A-clubs-10', 'A-diamonds-10', 'A-joker'] }] }, rng);
    if (!r3.ok) throw new Error(r3.reason);
    const r4 = applyAction(r3.match, 0, { type: 'returnJoker' }, rng);
    if (!r4.ok) throw new Error(r4.reason);
    expect(ids(r4.match.round.melds[0].cards)).toEqual(['B-hearts-4', 'A-hearts-5', 'B-hearts-6']);
    expect(ids(r4.match.round.melds[1].cards)).toEqual(['B-spades-4', 'B-joker', 'B-spades-6']);
    expect(ids(r4.match.round.players[0].hand).sort()).toEqual(['A-spades-5', 'A-spades-8']);
    expect(applyAction(r4.match, 0, { type: 'discard', cardId: 'A-spades-8' }, rng).ok).toBe(true);
  });
});
