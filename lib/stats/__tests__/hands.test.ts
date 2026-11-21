import { describe, it, expect } from 'vitest';
import { aggregateHands, rankLeaderboards, type MatchHands } from '../hands';

// Two players, three hands: Ann wins hand 1 (kalooki) and 3; Bob wins hand 2 (treasure).
const twoPlayer: MatchHands = {
  players: [{ userId: 'ann', name: 'Ann', seat: 0 }, { userId: 'bob', name: 'Bob', seat: 1 }],
  rounds: [
    { roundNumber: 1, winnerSeat: 0, goOutType: 'kalooki', scores: [0, 30] },
    { roundNumber: 2, winnerSeat: 1, goOutType: 'treasure', scores: [20, 30] },
    { roundNumber: 3, winnerSeat: 0, goOutType: 'normal', scores: [20, 40] },
  ],
};

describe('aggregateHands', () => {
  it('counts hands, wins, go-out types and points per player (from running totals)', () => {
    const agg = aggregateHands([twoPlayer]);
    expect(agg.get('ann')).toMatchObject({ hands: 3, wins: 2, kalookis: 1, treasures: 0, points: 20, pointHands: 3, parWins: 1.5 });
    expect(agg.get('bob')).toMatchObject({ hands: 3, wins: 1, kalookis: 0, treasures: 1, points: 40, pointHands: 3, parWins: 1.5 });
  });

  it('prefers exact per-hand points from the scorepad, and skips hands a seat sat out', () => {
    // 3 players. Cy busts after hand 1 and declines, so sits out hand 2.
    const m: MatchHands = {
      players: [{ userId: 'ann', name: 'Ann', seat: 0 }, { userId: 'bob', name: 'Bob', seat: 1 }, { userId: 'cy', name: 'Cy', seat: 2 }],
      rounds: [
        { roundNumber: 1, winnerSeat: 0, goOutType: 'normal', scores: [0, 10, 160] },
        { roundNumber: 2, winnerSeat: 1, goOutType: 'normal', scores: [25, 10, 160] },
      ],
      history: [
        { roundNumber: 1, handPoints: [0, 10, 160] },
        { roundNumber: 2, handPoints: [25, 0, 0] },
      ],
    };
    const agg = aggregateHands([m]);
    expect(agg.get('cy')).toMatchObject({ hands: 1, wins: 0, points: 160, pointHands: 1 });
    // Hand 1 had 3 players (par 1/3), hand 2 had 2 (par 1/2).
    expect(agg.get('ann')!.parWins).toBeCloseTo(1 / 3 + 1 / 2);
    expect(agg.get('ann')).toMatchObject({ hands: 2, wins: 1, points: 25 });
  });

  it('a rebuy reset without a scorepad: the hand counts as played but its points are skipped', () => {
    const m: MatchHands = {
      players: [{ userId: 'ann', name: 'Ann', seat: 0 }, { userId: 'bob', name: 'Bob', seat: 1 }, { userId: 'cy', name: 'Cy', seat: 2 }],
      rounds: [
        { roundNumber: 1, winnerSeat: 0, goOutType: 'normal', scores: [0, 40, 155] },
        // Cy bought back at 40 and scored 10 → 50 (went down: a reset).
        { roundNumber: 2, winnerSeat: 0, goOutType: 'normal', scores: [0, 45, 50] },
      ],
    };
    const cy = aggregateHands([m]).get('cy')!;
    expect(cy.hands).toBe(2);
    expect(cy.points).toBe(155);
    expect(cy.pointHands).toBe(1);
  });
});

describe('rankLeaderboards', () => {
  const mk = (userId: string, o: Partial<{ hands: number; wins: number; kalookis: number; treasures: number; points: number; pointHands: number; parWins: number }>) =>
    [userId, { userId, name: userId.toUpperCase(), hands: 20, wins: 5, kalookis: 0, treasures: 0, points: 300, pointHands: 20, parWins: 10, ...o }] as const;

  it('ranks each board in its own direction and drops players under the minimum', () => {
    const agg = new Map([
      mk('a', { wins: 8, kalookis: 2, points: 200 }),
      mk('b', { wins: 12, treasures: 1, points: 400 }),
      mk('c', { hands: 5, wins: 5 }), // too few hands
    ]);
    const b = rankLeaderboards(agg, { minHands: 10, limit: 10 });
    expect(b.vsPar.map((e) => e.userId)).toEqual(['b', 'a']);
    expect(b.vsPar[0].value).toBeCloseTo(1.2);
    expect(b.pointsPerHand.map((e) => e.userId)).toEqual(['a', 'b']); // lower is better
    expect(b.pointsPerHand[0].value).toBe(10);
    expect(b.winsPer100.map((e) => [e.userId, e.value])).toEqual([['b', 60], ['a', 40]]);
    expect(b.kalookisPer100.map((e) => [e.userId, e.value])).toEqual([['a', 10], ['b', 0]]);
    expect(b.treasuresPer100.map((e) => [e.userId, e.value])).toEqual([['b', 5], ['a', 0]]);
  });
});
