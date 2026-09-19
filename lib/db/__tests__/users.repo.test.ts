import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
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
