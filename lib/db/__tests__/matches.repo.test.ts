import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import {
  createMatch, getMatch, getMatchByJoinCode, listMatchesForUser, updateMatchStatus, setMatchWinner, deleteMatch,
} from '../repositories/matches';
import { matchPlayers, matches, gameStates } from '../schema';
import { sql } from 'drizzle-orm';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('matches repository', () => {
  it('creates and fetches a match by id and join code', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });

    const m = await createMatch(db as any, { createdBy: 'u1', seats: 3, joinCode: 'CODE1' });
    expect(m.status).toBe('lobby');
    expect(m.seats).toBe(3);

    expect((await getMatch(db as any, m.id))?.id).toBe(m.id);
    expect((await getMatchByJoinCode(db as any, 'CODE1'))?.id).toBe(m.id);
    expect(await getMatch(db as any, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('lists matches where a user holds a seat', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'CODE2' });
    await db.insert(matchPlayers).values({ matchId: m.id, userId: 'u2', seatIndex: 0 });

    const forU2 = await listMatchesForUser(db as any, 'u2');
    expect(forU2.map((x) => x.id)).toContain(m.id);
    const forU1 = await listMatchesForUser(db as any, 'u1');
    expect(forU1).toHaveLength(0); // u1 created it but holds no seat
  });

  it('lists a user’s matches most-recently-active first', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const mk = async (code: string, created: string, played?: string) => {
      const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: code });
      await db.insert(matchPlayers).values({ matchId: m.id, userId: 'u1', seatIndex: 0 });
      await db.update(matches).set({ createdAt: sql`${created}::timestamptz` }).where(eq(matches.id, m.id));
      if (played) {
        await db.insert(gameStates).values({ matchId: m.id, state: {} as any, updatedAt: sql`${played}::timestamptz` });
      }
      return m.id;
    };
    const oldButJustPlayed = await mk('R1', '2026-01-01T12:00:00Z', '2026-03-10T12:00:00Z');
    const newLobby = await mk('R2', '2026-03-01T12:00:00Z');
    const stale = await mk('R3', '2026-02-01T12:00:00Z', '2026-02-02T12:00:00Z');
    const list = await listMatchesForUser(db as any, 'u1');
    expect(list.map((m) => m.id)).toEqual([oldButJustPlayed, newLobby, stale]);
    // Game number = order of creation (shared by every player); last activity = last state change.
    expect(list.map((m) => m.number)).toEqual([1, 3, 2]);
    expect(list[0].lastActiveAt.toISOString().slice(0, 10)).toBe('2026-03-10');
    expect(list[1].lastActiveAt.toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  it('deletes a match and cascades its players', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'CODE4' });
    await db.insert(matchPlayers).values({ matchId: m.id, userId: 'u1', seatIndex: 0 });

    await deleteMatch(db as any, m.id);
    expect(await getMatch(db as any, m.id)).toBeNull();
    const seats = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, m.id));
    expect(seats).toHaveLength(0);
  });

  it('updates status and sets the winner', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'CODE3' });

    await updateMatchStatus(db as any, m.id, 'active');
    expect((await getMatch(db as any, m.id))?.status).toBe('active');

    await setMatchWinner(db as any, m.id, 'u1');
    const done = await getMatch(db as any, m.id);
    expect(done?.status).toBe('finished');
    expect(done?.winnerUserId).toBe('u1');
    expect(done?.finishedAt).not.toBeNull();
  });
});
