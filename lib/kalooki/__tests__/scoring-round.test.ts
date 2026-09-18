import { describe, it, expect } from 'vitest';
import { handScore, settleRound } from '../scoring';
import type { MatchState } from '../state';
import type { Card } from '../cards';

const nat = (rank: number, suit: string): Card =>
  ({ id: `A-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: 'A' });
const joker = (): Card => ({ id: 'A-joker', kind: 'joker', pack: 'A' });

describe('handScore', () => {
  it('scores pips, courts=10, ace=11, joker=15', () => {
    expect(handScore([nat(5, 'clubs'), nat(12, 'hearts'), nat(14, 'spades'), joker()])).toBe(5 + 10 + 11 + 15);
  });
});

describe('settleRound', () => {
  it('winner gets 0, losers add hand points, losers pay bits (normal=1)', () => {
    const round: any = {
      players: [
        { seat: 0, hand: [], hasOpened: true },
        { seat: 1, hand: [nat(9, 'clubs'), nat(10, 'clubs')], hasOpened: false },
      ],
      melds: [], stock: [], discard: [], turn: 0, dealerSeat: 1, phase: 'awaitingDraw',
      drawObligation: null, addedToOpponentThisTurn: false,
      finished: true, winnerSeat: 0, goOutType: 'normal',
    };
    const m: MatchState = { seats: 2, pot: 8, treasureUsed: false, scores: [0, 0],
      statuses: ['active', 'active'], rebought: [false, false], round, roundNumber: 1,
      finished: false, winnerSeat: null };
    const out = settleRound(m);
    expect(out.scores).toEqual([0, 19]);
    expect(out.pot).toBe(9); // one loser pays 1
  });

  it('kalooki charges 2, treasure charges 4', () => {
    const mk = (type: string, pot: number): MatchState => ({
      seats: 2, pot, treasureUsed: false, scores: [0, 0], statuses: ['active', 'active'],
      rebought: [false, false], roundNumber: 1, finished: false, winnerSeat: null,
      round: { players: [{ seat: 0, hand: [], hasOpened: true }, { seat: 1, hand: [nat(2, 'clubs')], hasOpened: true }],
        melds: [], stock: [], discard: [], turn: 0, dealerSeat: 1, phase: 'awaitingDraw',
        drawObligation: null, addedToOpponentThisTurn: false, finished: true, winnerSeat: 0, goOutType: type } as any,
    });
    expect(settleRound(mk('kalooki', 8)).pot).toBe(10);
    expect(settleRound(mk('treasure', 8)).pot).toBe(12);
  });
});
