import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

// Seat 0 has taken the top of the discard (the 4♣) this turn and can't use it.
function fixtureWithObligation(): MatchState {
  const taken = nat(4, 'clubs');
  const round = {
    players: [
      { seat: 0, hand: [nat(5, 'clubs'), nat(9, 'hearts'), taken], hasOpened: true },
      { seat: 1, hand: [nat(2, 'clubs')], hasOpened: false },
    ],
    melds: [], stock: [nat(3, 'clubs')], discard: [nat(7, 'spades')], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: taken, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
    turnStartHandSize: 2, openedAtTurnStart: true,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round: round as any, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('returnDiscard', () => {
  it('puts the taken card back and re-enters the draw phase', () => {
    const m = fixtureWithObligation();
    const r = applyAction(m, 0, { type: 'returnDiscard' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const round = r.match.round;
      expect(round.phase).toBe('awaitingDraw');
      expect(round.drawObligation).toBeNull();
      // card removed from hand, restored as the top of the discard pile
      expect(round.players[0].hand.some((c) => c.id === 'A-clubs-4')).toBe(false);
      expect(round.discard[round.discard.length - 1].id).toBe('A-clubs-4');
      // and now a stock draw is legal again
      const draw = applyAction(r.match, 0, { type: 'draw', source: 'stock' }, () => 0.5);
      expect(draw.ok).toBe(true);
    }
  });

  it('rejects when there is no draw obligation', () => {
    const m = fixtureWithObligation();
    (m.round as any).drawObligation = null;
    const r = applyAction(m, 0, { type: 'returnDiscard' }, () => 0.5);
    expect(r.ok).toBe(false);
  });

  it('rejects during the draw phase', () => {
    const m = fixtureWithObligation();
    (m.round as any).phase = 'awaitingDraw';
    const r = applyAction(m, 0, { type: 'returnDiscard' }, () => 0.5);
    expect(r.ok).toBe(false);
  });
});
