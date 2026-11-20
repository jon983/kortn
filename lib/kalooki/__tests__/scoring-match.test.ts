import { describe, it, expect } from 'vitest';
import { applyBusts, rebuy, matchWinner, awardPot, canRebuy, resolveImpossibleRebuys, inferBoughtBack } from '../scoring';
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

describe('rebuy eligibility', () => {
  it('a busted seat may rebuy only while at least two seats are still in', () => {
    expect(canRebuy(base([154, 40], ['busted', 'active']), 0)).toBe(false);
    expect(canRebuy(base([154, 40, 90], ['busted', 'active', 'active']), 0)).toBe(true);
    expect(canRebuy(base([154, 160, 90], ['busted', 'busted', 'active']), 0)).toBe(false);
    expect(canRebuy(base([154, 40, 90], ['busted', 'active', 'active'], 12, [true, false, false]), 0)).toBe(false);
  });

  it('resolveImpossibleRebuys marks seats that cannot rebuy as out, leaving the rest pending', () => {
    const twoP = resolveImpossibleRebuys(base([154, 40], ['busted', 'active']));
    expect(twoP.rebought).toEqual([true, false]);
    expect(matchWinner(twoP)).toBe(1);
    const threeP = resolveImpossibleRebuys(base([154, 40, 90], ['busted', 'active', 'active']));
    expect(threeP.rebought).toEqual([false, false, false]);
  });

  it('rebuy records that the seat actually bought back (distinct from declining)', () => {
    const m = rebuy(base([151, 40, 90], ['busted', 'active', 'active'], 12), 0);
    expect(m.boughtBack).toEqual([true, false, false]);
  });
});

describe('pot payout', () => {
  it('everyone pays the 4-bit ante, rebuys cost 4 more, and the winner collects the pot', () => {
    // 3 seats → pot 12; seat 2 bought back (+4 → 16); seat 0 wins.
    const m: MatchState = {
      ...base([90, 160, 170], ['active', 'busted', 'busted'], 16, [false, true, true]),
      bits: [5, -2, -3],
      boughtBack: [false, false, true],
    };
    const done = awardPot(m);
    expect(done.finished).toBe(true);
    expect(done.payout).toEqual([12, -4, -8]);
    expect(done.bits).toEqual([17, -6, -11]);
    expect(done.bits.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('leaves bits untouched while the match is still going', () => {
    const m = { ...base([90, 40], ['active', 'active'], 8), bits: [3, -3] };
    const r = awardPot(m);
    expect(r.finished).toBe(false);
    expect(r.payout).toBeUndefined();
    expect(r.bits).toEqual([3, -3]);
  });
});

describe('pot payout — matches from before boughtBack was tracked', () => {
  it('infers who bought back from the scorepad so the payout still balances', () => {
    // Seat 2 went over 150 after hand 1, bought back, and kept scoring in hand 2.
    const history: any[] = [
      { roundNumber: 1, scores: [10, 40, 160], handPoints: [10, 40, 160] },
      { roundNumber: 2, scores: [10, 160, 70], handPoints: [0, 120, 30] }, // seat 2 went 160 → reset to 40 → +30
    ];
    const m: MatchState = {
      ...base([10, 160, 170], ['active', 'busted', 'busted'], 16, [false, true, true]),
      bits: [4, -2, -2],
      history,
    };
    const done = awardPot(m);
    expect(done.boughtBack).toEqual([false, false, true]);
    expect(done.payout).toEqual([12, -4, -8]);
    expect(done.bits.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('inferBoughtBack', () => {
  it('counts a seat that is back in play after a rebuy decision, even before its next scored hand', () => {
    // 4 seats, pot 24 → 2 rebuys: seat 0 rebought after hand 2 (score reset), seat 3 just rebought.
    const history: any[] = [
      { scores: [109, 71, 0, 38], handPoints: [109, 71, 0, 38] },
      { scores: [154, 79, 0, 52], handPoints: [45, 8, 0, 14] },
      { scores: [132, 162, 0, 159], handPoints: [53, 83, 0, 107] },
    ];
    const m: MatchState = {
      ...base([132, 162, 0, 132], ['active', 'busted', 'active', 'active'], 24, [true, true, false, true]),
      history,
    };
    expect(inferBoughtBack(m)).toEqual([true, false, false, true]);
  });
});
