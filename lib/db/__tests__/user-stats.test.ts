import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser, incrementUserStats, getUserStats } from '../index';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('getUserStats', () => {
  it('returns cumulative stats, null for unknown', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await incrementUserStats(db as any, 'u1', { gamesPlayed: 2, roundsWon: 5, bitsNet: -3 });
    expect(await getUserStats(db as any, 'u1')).toEqual({ gamesPlayed: 2, roundsWon: 5, bitsNet: -3 });
    expect(await getUserStats(db as any, 'nobody')).toBeNull();
  });
});
