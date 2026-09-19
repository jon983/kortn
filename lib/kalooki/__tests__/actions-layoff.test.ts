import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

function fixtureWithMeld(): MatchState {
  const run = [nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')];
  const round = {
    players: [{ seat: 0, hand: [nat(7, 'hearts')], hasOpened: true }, { seat: 1, hand: [], hasOpened: true }],
    melds: [{ id: 'm1-0', kind: 'run' as const, ownerSeat: 0, cards: run }],
    stock: [nat(2, 'clubs')], discard: [], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('layoff', () => {
  it('extends a run with a valid card', () => {
    const m = fixtureWithMeld();
    const r = applyAction(m, 0, { type: 'layoff', cardId: 'A-hearts-7', meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.melds[0].cards).toHaveLength(4);
      expect(r.match.round.players[0].hand).toHaveLength(0);
    }
  });

  it('rejects layoff before opening', () => {
    const m = fixtureWithMeld();
    m.round.players[0].hasOpened = false;
    const r = applyAction(m, 0, { type: 'layoff', cardId: 'A-hearts-7', meldId: 'm1-0' }, () => 0.5);
    expect(r.ok).toBe(false);
  });
});
