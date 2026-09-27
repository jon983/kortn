import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

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

describe('layoff → joker retrieval', () => {
  it('a run: laying off the joker’s exact card reclaims the joker', () => {
    // 4h-[joker as 5h]-6h; laying off 5h reclaims the joker.
    const m = fixture({ kind: 'run', cards: [nat(4, 'hearts', 'B'), joker(), nat(6, 'hearts', 'B')] }, [nat(5, 'hearts'), nat(8, 'spades')]);
    const r = applyAction(m, 0, { type: 'layoff', cardIds: ['A-hearts-5'], meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const run = r.match.round.melds[0];
    expect(run.cards.some((c) => c.kind === 'joker')).toBe(false);
    expect(run.cards.map((c) => c.id)).toEqual(['B-hearts-4', 'A-hearts-5', 'B-hearts-6']);
    expect(r.match.round.players[0].hand.some((c) => c.kind === 'joker')).toBe(true);
    expect(r.match.round.jokerObligation).toEqual(['A-joker']);
  });

  it('a run: laying off an end card just extends it, joker stays', () => {
    const m = fixture({ kind: 'run', cards: [nat(4, 'hearts', 'B'), joker(), nat(6, 'hearts', 'B')] }, [nat(7, 'hearts')]);
    const r = applyAction(m, 0, { type: 'layoff', cardIds: ['A-hearts-7'], meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.match.round.melds[0].cards).toHaveLength(4);
    expect(r.match.round.melds[0].cards.some((c) => c.kind === 'joker')).toBe(true);
    expect(r.match.round.jokerObligation ?? []).toEqual([]);
  });

  it('a set: laying off the two missing suits completes four of a kind and reclaims the joker', () => {
    const m = fixture({ kind: 'set', cards: [nat(9, 'clubs', 'B'), nat(9, 'hearts', 'B'), joker()] }, [nat(9, 'diamonds'), nat(9, 'spades')]);
    const r = applyAction(m, 0, { type: 'layoff', cardIds: ['A-diamonds-9', 'A-spades-9'], meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const set = r.match.round.melds[0];
    expect(set.cards).toHaveLength(4);
    expect(set.cards.some((c) => c.kind === 'joker')).toBe(false);
    expect(r.match.round.players[0].hand.some((c) => c.kind === 'joker')).toBe(true);
  });

  it('a set: laying off a single natural just extends to four cards, joker stays', () => {
    const m = fixture({ kind: 'set', cards: [nat(9, 'clubs', 'B'), nat(9, 'hearts', 'B'), joker()] }, [nat(9, 'diamonds')]);
    const r = applyAction(m, 0, { type: 'layoff', cardIds: ['A-diamonds-9'], meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.match.round.melds[0].cards).toHaveLength(4);
    expect(r.match.round.melds[0].cards.some((c) => c.kind === 'joker')).toBe(true);
  });

  it('blocks discarding a reclaimed joker (must go into a new meld)', () => {
    const m = fixture({ kind: 'run', cards: [nat(4, 'hearts', 'B'), joker(), nat(6, 'hearts', 'B')] }, [nat(5, 'hearts'), nat(8, 'spades')]);
    const r1 = applyAction(m, 0, { type: 'layoff', cardIds: ['A-hearts-5'], meldId: 'm1-0' }, () => 0.5);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = applyAction(r1.match, 0, { type: 'discard', cardId: 'A-spades-8' }, () => 0.5);
    expect(r2.ok).toBe(false);
    const r3 = applyAction(r1.match, 0, { type: 'layoff', cardIds: ['A-joker'], meldId: 'm1-0' }, () => 0.5);
    expect(r3.ok).toBe(false);
  });
});
