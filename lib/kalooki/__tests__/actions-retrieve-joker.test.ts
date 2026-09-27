import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (pack = 'A'): Card => ({ id: `${pack}-joker`, kind: 'joker', pack: pack as any });

function runFixture(hand: Card[]): MatchState {
  // Table run 4h-[joker as 5h]-6h owned by seat 1; seat 0 is to act.
  const tableRun = [nat(4, 'hearts', 'B'), joker('A'), nat(6, 'hearts', 'B')];
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', kind: 'run' as const, ownerSeat: 1, cards: tableRun }],
    stock: [nat(2, 'clubs')], discard: [nat(3, 'clubs')], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

function setFixture(hand: Card[]): MatchState {
  // Table set of rank 9 owned by seat 1: 9c, 9h, [joker as 9?].
  const tableSet = [nat(9, 'clubs', 'B'), nat(9, 'hearts', 'B'), joker('A')];
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', kind: 'set' as const, ownerSeat: 1, cards: tableSet }],
    stock: [nat(2, 'clubs')], discard: [nat(3, 'clubs')], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('retrieveJoker (run)', () => {
  it('takes the joker into hand with one natural and leaves an all-natural run', () => {
    const m = runFixture([nat(5, 'hearts'), nat(8, 'spades')]);
    const r = applyAction(m, 0, { type: 'retrieveJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardIds: ['A-hearts-5'] }, () => 0.5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const run = r.match.round.melds.find((x) => x.id === 'm1-0')!;
    expect(run.cards.some((c) => c.kind === 'joker')).toBe(false);
    expect(run.cards.map((c) => c.id)).toEqual(['B-hearts-4', 'A-hearts-5', 'B-hearts-6']);
    const hand = r.match.round.players[0].hand;
    expect(hand.some((c) => c.kind === 'joker')).toBe(true);
    expect(r.match.round.jokerObligation).toEqual(['A-joker']);
  });

  it('rejects a natural that does not complete the run', () => {
    const m = runFixture([nat(7, 'hearts'), nat(8, 'spades')]);
    const r = applyAction(m, 0, { type: 'retrieveJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardIds: ['A-hearts-7'] }, () => 0.5);
    expect(r.ok).toBe(false);
  });

  it('rejects more than one card for a run', () => {
    const m = runFixture([nat(5, 'hearts'), nat(6, 'hearts')]);
    const r = applyAction(m, 0, { type: 'retrieveJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardIds: ['A-hearts-5', 'A-hearts-6'] }, () => 0.5);
    expect(r.ok).toBe(false);
  });

  it('blocks discarding while a reclaimed joker is still in hand', () => {
    const m = runFixture([nat(5, 'hearts'), nat(8, 'spades')]);
    const r1 = applyAction(m, 0, { type: 'retrieveJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardIds: ['A-hearts-5'] }, () => 0.5);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = applyAction(r1.match, 0, { type: 'discard', cardId: 'A-spades-8' }, () => 0.5);
    expect(r2.ok).toBe(false);
  });

  it('forbids laying the reclaimed joker off onto an existing meld', () => {
    const m = runFixture([nat(5, 'hearts'), nat(8, 'spades')]);
    const r1 = applyAction(m, 0, { type: 'retrieveJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardIds: ['A-hearts-5'] }, () => 0.5);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    // m1-0 is now 4h-5h-6h; a joker would otherwise extend it, but it must go in a new meld.
    const r2 = applyAction(r1.match, 0, { type: 'layoff', cardId: 'A-joker', meldId: 'm1-0' }, () => 0.5);
    expect(r2.ok).toBe(false);
  });
});

describe('retrieveJoker (set)', () => {
  it('completes the set to four of a kind with two naturals and frees the joker', () => {
    const m = setFixture([nat(9, 'diamonds'), nat(9, 'spades'), nat(8, 'clubs')]);
    const r = applyAction(m, 0, { type: 'retrieveJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardIds: ['A-diamonds-9', 'A-spades-9'] }, () => 0.5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const set = r.match.round.melds.find((x) => x.id === 'm1-0')!;
    expect(set.cards).toHaveLength(4);
    expect(set.cards.some((c) => c.kind === 'joker')).toBe(false);
    expect(r.match.round.players[0].hand.some((c) => c.kind === 'joker')).toBe(true);
  });

  it('rejects retrieving from a set with only one natural (would not reach four)', () => {
    const m = setFixture([nat(9, 'diamonds'), nat(8, 'clubs')]);
    const r = applyAction(m, 0, { type: 'retrieveJoker', meldId: 'm1-0', jokerId: 'A-joker', naturalCardIds: ['A-diamonds-9'] }, () => 0.5);
    expect(r.ok).toBe(false);
  });
});
