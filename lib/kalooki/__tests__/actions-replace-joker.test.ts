import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

function fixture(): MatchState {
  // Table run 4h-[joker as 5h]-6h owned by seat 1. Seat 0 holds the natural 5h
  // plus two more hearts (3h,7h... actually 5h natural + a fresh meld 9c/9d/9h to re-home joker).
  const tableRun = [nat(4, 'hearts', 'B'), joker('A'), nat(6, 'hearts', 'B')];
  const hand = [nat(5, 'hearts'), nat(9, 'clubs'), nat(9, 'diamonds')];
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', kind: 'run' as const, ownerSeat: 1, cards: tableRun }],
    stock: [nat(2, 'clubs')], discard: [], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('replaceJoker (run)', () => {
  it('swaps the natural in and re-melds the freed joker', () => {
    const m = fixture();
    const r = applyAction(m, 0, {
      type: 'replaceJoker',
      meldId: 'm1-0', jokerId: 'A-joker', naturalCardId: 'A-hearts-5',
      newMeld: { kind: 'set', cardIds: ['A-joker', 'A-clubs-9', 'A-diamonds-9'] },
    }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const run = r.match.round.melds.find((x) => x.id === 'm1-0')!;
      expect(run.cards.some((c) => c.id === 'A-hearts-5')).toBe(true);
      expect(run.cards.some((c) => c.kind === 'joker')).toBe(false);
      expect(r.match.round.melds.some((x) => x.cards.some((c) => c.id === 'A-joker'))).toBe(true);
    }
  });

  it('rejects if the freed joker is not immediately melded', () => {
    const m = fixture();
    const r = applyAction(m, 0, {
      type: 'replaceJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardId: 'A-hearts-5',
      newMeld: { kind: 'set', cardIds: ['A-clubs-9', 'A-diamonds-9'] }, // no joker => invalid
    }, () => 0.5);
    expect(r.ok).toBe(false);
  });

  it('rejects when the natural cannot legally replace the joker in the run', () => {
    const m = fixture();
    // 4h-[joker as 5h]-6h; inserting 7h yields 4h,7h,6h which is not a valid run.
    m.round.players[0].hand = [nat(7, 'hearts'), nat(9, 'clubs'), nat(9, 'diamonds')];
    const r = applyAction(m, 0, {
      type: 'replaceJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardId: 'A-hearts-7',
      newMeld: { kind: 'set', cardIds: ['A-joker', 'A-clubs-9', 'A-diamonds-9'] },
    }, () => 0.5);
    expect(r.ok).toBe(false);
  });
});

function setFixture(): MatchState {
  // Table set of rank 9 owned by seat 1: 9c, 9h, [joker as 9s].
  const tableSet = [nat(9, 'clubs', 'B'), nat(9, 'hearts', 'B'), joker('A')];
  // Seat 0 holds the natural 9s (absent suit) plus two diamonds to re-home the joker.
  const hand = [nat(9, 'spades'), nat(4, 'diamonds'), nat(6, 'diamonds')];
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', kind: 'set' as const, ownerSeat: 1, cards: tableSet }],
    stock: [nat(2, 'clubs')], discard: [], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('replaceJoker (set)', () => {
  it('swaps a natural of the set rank in an absent suit and re-melds the freed joker', () => {
    const m = setFixture();
    const r = applyAction(m, 0, {
      type: 'replaceJoker',
      meldId: 'm1-0', jokerId: 'A-joker', naturalCardId: 'A-spades-9',
      newMeld: { kind: 'run', cardIds: ['A-diamonds-4', 'A-joker', 'A-diamonds-6'] },
    }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const set = r.match.round.melds.find((x) => x.id === 'm1-0')!;
      expect(set.cards.some((c) => c.id === 'A-spades-9')).toBe(true);
      expect(set.cards.some((c) => c.kind === 'joker')).toBe(false);
      const newRun = r.match.round.melds.find((x) => x.id !== 'm1-0')!;
      expect(newRun.cards.some((c) => c.id === 'A-joker')).toBe(true);
    }
  });
});
