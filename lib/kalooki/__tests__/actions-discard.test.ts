import { describe, it, expect } from 'vitest';
import { applyAction } from '../actions';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });

function fixture(hand: Card[]): MatchState {
  const round = {
    players: [{ seat: 0, hand, hasOpened: true }, { seat: 1, hand: [nat(2, 'clubs')], hasOpened: false }],
    melds: [], stock: [nat(3, 'clubs')], discard: [nat(4, 'clubs')], turn: 0, dealerSeat: 1,
    phase: 'awaitingDiscard' as const, drawObligation: null, addedToOpponentThisTurn: false,
    finished: false, winnerSeat: null, goOutType: null,
    turnStartHandSize: 2, openedAtTurnStart: true,
  };
  return { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0], bits: [0, 0], statuses: ['active', 'active'],
    rebought: [false, false], round: round as any, roundNumber: 1, finished: false, winnerSeat: null };
}

describe('discard & go-out', () => {
  it('discards and advances the turn when hand remains', () => {
    const m = fixture([nat(5, 'clubs'), nat(6, 'clubs')]);
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.turn).toBe(1);
      expect(r.match.round.phase).toBe('awaitingDraw');
      expect(r.match.round.discard[r.match.round.discard.length - 1].id).toBe('A-clubs-5');
    }
  });

  it('ends the round when discarding empties the hand', () => {
    const m = fixture([nat(5, 'clubs')]);
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.finished).toBe(true);
      expect(r.match.round.winnerSeat).toBe(0);
      expect(r.match.round.goOutType).toBe('normal');
    }
  });

  it('rejects discarding while a draw obligation is unmet', () => {
    const m = fixture([nat(5, 'clubs'), nat(6, 'clubs')]);
    (m.round as any).drawObligation = nat(6, 'clubs');
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(false);
  });

  it('awards treasure when going out having laid all 13 in one turn', () => {
    const m = fixture([nat(5, 'clubs')]);
    (m.round as any).players[0].hasOpened = true;
    (m.round as any).turnStartHandSize = 13;
    (m.round as any).openedAtTurnStart = false;
    (m.round as any).addedToOpponentThisTurn = false;
    m.treasureUsed = false;
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.finished).toBe(true);
      expect(r.match.round.winnerSeat).toBe(0);
      expect(r.match.round.goOutType).toBe('treasure');
      expect(r.match.treasureUsed).toBe(true);
    }
  });

  it('downgrades to kalooki when the treasure was already used', () => {
    const m = fixture([nat(5, 'clubs')]);
    (m.round as any).turnStartHandSize = 13;
    (m.round as any).openedAtTurnStart = false;
    (m.round as any).addedToOpponentThisTurn = false;
    m.treasureUsed = true;
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.goOutType).toBe('kalooki');
      expect(r.match.treasureUsed).toBe(true);
    }
  });

  it('downgrades to kalooki when a card was added to an opponent meld this turn', () => {
    const m = fixture([nat(5, 'clubs')]);
    (m.round as any).turnStartHandSize = 13;
    (m.round as any).openedAtTurnStart = false;
    (m.round as any).addedToOpponentThisTurn = true;
    m.treasureUsed = false;
    const r = applyAction(m, 0, { type: 'discard', cardId: 'A-clubs-5' }, () => 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.match.round.goOutType).toBe('kalooki');
      expect(r.match.treasureUsed).toBe(false);
    }
  });
});
