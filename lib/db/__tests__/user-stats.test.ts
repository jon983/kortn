import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser, getUserStats, getVsParLeaderboard } from '../index';
import { matches, matchPlayers, rounds, gameStates } from '../schema';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('getUserStats (computed from game data)', () => {
  it('computes wins, vs-par, avg points, bits, kalookis from a finished 2p match', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });

    const [m] = await db.insert(matches).values({
      createdBy: 'u1', seats: 2, joinCode: 'S1', status: 'finished', winnerUserId: 'u1',
    }).returning();
    await db.insert(matchPlayers).values([
      { matchId: m.id, userId: 'u1', seatIndex: 0 },
      { matchId: m.id, userId: 'u2', seatIndex: 1 },
    ]);
    await db.insert(rounds).values([
      { matchId: m.id, roundNumber: 1, dealerSeat: 0, winnerSeat: 0, goOutType: 'kalooki', scores: [0, 20] },
      { matchId: m.id, roundNumber: 2, dealerSeat: 1, winnerSeat: 1, goOutType: 'normal', scores: [15, 20] },
    ]);
    await db.insert(gameStates).values({
      matchId: m.id, version: 1, state: { bits: [6, -6], scores: [15, 20], pot: 8 } as any,
    });

    const s = await getUserStats(db as any, 'u1');
    expect(s.gamesPlayed).toBe(1);
    expect(s.gamesWon).toBe(1);
    expect(s.winRate).toBe(1);
    expect(s.roundsWon).toBe(1);
    expect(s.parWins).toBeCloseTo(1.0, 5);            // 1/2 + 1/2
    expect(s.vsPar).toBeCloseTo(1.0, 5);              // 1 won / 1.0 par
    expect(s.avgPointsPerRound).toBeCloseTo(7.5, 5);  // 15 points / 2 rounds
    expect(s.netBits).toBe(6);
    expect(s.kalookis).toBe(1);
    expect(s.treasures).toBe(0);
    expect(s.potWinnings).toBe(8);

    const o = await getUserStats(db as any, 'u2');
    expect(o.gamesWon).toBe(0);
    expect(o.roundsWon).toBe(1);
    expect(o.netBits).toBe(-6);
    expect(o.potWinnings).toBe(0);
  });

  it('ranks players by vs-par on the leaderboard', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const [m] = await db.insert(matches).values({ createdBy: 'u1', seats: 2, joinCode: 'S2', status: 'finished', winnerUserId: 'u1' }).returning();
    await db.insert(matchPlayers).values([
      { matchId: m.id, userId: 'u1', seatIndex: 0 },
      { matchId: m.id, userId: 'u2', seatIndex: 1 },
    ]);
    // 4 rounds, u1 wins 3 of them → u1 well above par, u2 below.
    await db.insert(rounds).values([
      { matchId: m.id, roundNumber: 1, dealerSeat: 0, winnerSeat: 0, goOutType: 'normal', scores: [0, 10] },
      { matchId: m.id, roundNumber: 2, dealerSeat: 1, winnerSeat: 0, goOutType: 'normal', scores: [0, 20] },
      { matchId: m.id, roundNumber: 3, dealerSeat: 0, winnerSeat: 0, goOutType: 'normal', scores: [0, 30] },
      { matchId: m.id, roundNumber: 4, dealerSeat: 1, winnerSeat: 1, goOutType: 'normal', scores: [10, 30] },
    ]);

    const board = await getVsParLeaderboard(db as any, { limit: 10 });
    expect(board.map((e) => e.userId)).toEqual(['u1', 'u2']); // u1 ranked first
    expect(board[0].vsPar).toBeCloseTo(1.5, 5); // 3 won / (4 * 0.5 = 2 par)
    expect(board[1].vsPar).toBeCloseTo(0.5, 5); // 1 won / 2 par
  });

  it('returns zeroed stats for a user with no games', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const s = await getUserStats(db as any, 'u1');
    expect(s.gamesPlayed).toBe(0);
    expect(s.vsPar).toBeNull();
    expect(s.avgPointsPerRound).toBeNull();
    expect(s.netBits).toBe(0);
  });
});
