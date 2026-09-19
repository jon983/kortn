import { describe, it, expect } from 'vitest';
import { applyBusts, rebuy, matchWinner, awardPot } from '../scoring';
import type { MatchState } from '../state';

const base = (scores: number[], statuses: any[], pot = 12, rebought?: boolean[]): MatchState => ({
  seats: scores.length, pot, treasureUsed: false, scores, statuses, bits: scores.map(() => 0),
  rebought: rebought ?? scores.map(() => false),
  round: {} as any, roundNumber: 1, finished: false, winnerSeat: null,
});

describe('match end', () => {
  it('busts a player over 150', () => {
    const m = applyBusts(base([160, 40, 90], ['active', 'active', 'active']));
    expect(m.statuses[0]).toBe('busted');
  });

  it('rebuy re-enters at current highest active score and adds 4 to pot', () => {
    const m = rebuy(base([151, 40, 90], ['busted', 'active', 'active'], 12), 0);
    expect(m.scores[0]).toBe(90); // highest active is 90
    expect(m.statuses[0]).toBe('active');
    expect(m.rebought[0]).toBe(true);
    expect(m.pot).toBe(16);
  });

  it('rejects a second rebuy', () => {
    expect(() => rebuy(base([151, 40], ['busted', 'active'], 12, [true, false]), 0)).toThrow();
  });

  it('declares the last active player the winner', () => {
    const m = base([160, 40, 200], ['busted', 'active', 'busted']);
    expect(matchWinner(m)).toBe(1);
    const done = awardPot(m);
    expect(done.finished).toBe(true);
    expect(done.winnerSeat).toBe(1);
  });
});
