import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import {
  createMatch, getMatch, getMatchByJoinCode, listMatchesForUser, updateMatchStatus, setMatchWinner,
} from '../repositories/matches';
import { matchPlayers } from '../schema';

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
