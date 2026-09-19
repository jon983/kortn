import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

// Build a controlled match state by hand for deterministic melding.
function fixture(hand: Card[]): MatchState {
  const round = {
    players: [{ seat: 0, hand, hasOpened: false }, { seat: 1, hand: [], hasOpened: false }],
    melds: [], stock: [{ id: 'S1', kind: 'natural', rank: 2, suit: 'clubs', pack: 'A' } as Card],
    discard: [], turn: 0, dealerSeat: 1, phase: 'awaitingDiscard' as const,
    drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return {
    seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0],
    statuses: ['active', 'active'], rebought: [false, false],
    round, roundNumber: 1, finished: false, winnerSeat: null,
  };
}
const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

describe('meld / opening gate', () => {
  it('rejects opening below 40 points', () => {
    const hand = [nat(3, 'clubs'), nat(3, 'hearts'), nat(3, 'spades')]; // 9 pts
    const m = fixture(hand);
    const r = applyAction(m, 0, { type: 'meld', groups: [{ kind: 'set', cardIds: hand.map((c) => c.id) }] }, () => 0.5);
    expect(r.ok).toBe(false);
  });

  it('opens with 40+ across multiple melds in one turn', () => {
    const setK = [nat(13, 'clubs'), nat(13, 'hearts'), nat(13, 'spades')]; // 30
    const run = [nat(4, 'diamonds'), nat(5, 'diamonds'), nat(6, 'diamonds')]; // 15 => 45 total
    const hand = [...setK, ...run];
    const m = fixture(hand);
    const r = applyAction(m, 0, {
      type: 'meld',
      groups: [
        { kind: 'set', cardIds: setK.map((c) => c.id) },
        { kind: 'run', cardIds: run.map((c) => c.id) },
      ],
    }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.players[0].hasOpened).toBe(true);
      expect(r.match.round.melds).toHaveLength(2);
      expect(r.match.round.players[0].hand).toHaveLength(0);
    }
  });
});
