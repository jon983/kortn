import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { createMatch } from '../repositories/matches';
import { addPlayer, listPlayers, updatePlayer } from '../repositories/players';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seed(db: any) {
  await upsertUser(db, { id: 'u1', displayName: 'A' });
  await upsertUser(db, { id: 'u2', displayName: 'B' });
  const m = await createMatch(db, { createdBy: 'u1', seats: 2, joinCode: 'P1' });
  return m.id as string;
}

describe('players repository', () => {
  it('adds players and lists them ordered by seat', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    await addPlayer(db as any, { matchId, userId: 'u2', seatIndex: 1 });
    await addPlayer(db as any, { matchId, userId: 'u1', seatIndex: 0 });
    const players = await listPlayers(db as any, matchId);
    expect(players.map((p) => p.seatIndex)).toEqual([0, 1]);
    expect(players[0].userId).toBe('u1');
  });

  it('updates only the provided fields', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    await addPlayer(db as any, { matchId, userId: 'u1', seatIndex: 0 });
    await updatePlayer(db as any, matchId, 0, { score: 42, status: 'busted' });
    const [p] = await listPlayers(db as any, matchId);
    expect(p.score).toBe(42);
    expect(p.status).toBe('busted');
    expect(p.rebought).toBe(false); // untouched
    // empty update is a no-op and must not throw
    await updatePlayer(db as any, matchId, 0, {});
  });

  it('rejects a second addPlayer with the same userId in the same match', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    await addPlayer(db as any, { matchId, userId: 'u1', seatIndex: 0 });
    await expect(
      addPlayer(db as any, { matchId, userId: 'u1', seatIndex: 1 }),
    ).rejects.toThrow();
  });
});
