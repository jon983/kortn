import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser, incrementUserStats } from '../repositories/users';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('upsertUser', () => {
  it('inserts a new user and updates on conflict without resetting stats', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();

    await upsertUser(db as any, { id: 'u1', displayName: 'Alice' });
    // bump a stat directly to prove upsert doesn't clobber it
    await db.update(users).set({ gamesPlayed: 5 }).where(eq(users.id, 'u1'));

    await upsertUser(db as any, { id: 'u1', displayName: 'Alice Renamed', avatarUrl: 'x.png' });
    const [u] = await db.select().from(users).where(eq(users.id, 'u1'));
    expect(u.displayName).toBe('Alice Renamed');
    expect(u.avatarUrl).toBe('x.png');
    expect(u.gamesPlayed).toBe(5); // untouched
  });
});

describe('incrementUserStats', () => {
  it('atomically increments provided stat columns', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();

    await upsertUser(db as any, { id: 'u2', displayName: 'Bob' });
    await incrementUserStats(db as any, 'u2', { gamesPlayed: 1, bitsNet: -3 });
    await incrementUserStats(db as any, 'u2', { bitsNet: 5 });

    const [u] = await db.select().from(users).where(eq(users.id, 'u2'));
    expect(u.gamesPlayed).toBe(1);
    expect(u.bitsNet).toBe(2);
    expect(u.roundsWon).toBe(0); // untouched
  });

  it('empty delta is a no-op and does not throw', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();

    await upsertUser(db as any, { id: 'u3', displayName: 'Carol' });
    await expect(incrementUserStats(db as any, 'u3', {})).resolves.toBeUndefined();

    const [u] = await db.select().from(users).where(eq(users.id, 'u3'));
    expect(u.gamesPlayed).toBe(0);
  });
});
