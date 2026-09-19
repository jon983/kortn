import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { users, matches, matchPlayers } from '../schema';
import { eq } from 'drizzle-orm';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('core schema', () => {
  it('inserts a user, a match, and a match_player with a composite key', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();

    await db.insert(users).values({ id: 'u1', displayName: 'Alice' });
    const [m] = await db.insert(matches).values({
      createdBy: 'u1', seats: 2, joinCode: 'ABCD',
    }).returning();
    expect(m.status).toBe('lobby');
    expect(m.pot).toBe(0);

    await db.insert(matchPlayers).values({ matchId: m.id, userId: 'u1', seatIndex: 0 });
    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, m.id));
    expect(players).toHaveLength(1);
    expect(players[0].status).toBe('active');
    expect(players[0].score).toBe(0);
  });

  it('enforces unique joinCode', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await db.insert(users).values({ id: 'u1', displayName: 'Alice' });
    await db.insert(matches).values({ createdBy: 'u1', seats: 2, joinCode: 'DUPE' });
    await expect(
      db.insert(matches).values({ createdBy: 'u1', seats: 2, joinCode: 'DUPE' }),
    ).rejects.toThrow();
  });
});
