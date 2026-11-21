import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { leaveLobby } from '../matches';
import { upsertUser, createMatch, addPlayer, listPlayers } from '../../db';
import { matches } from '../../db/schema';
import { makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function setup(status: 'lobby' | 'active' = 'lobby') {
  const { db, client } = await makeTestDb();
  close = () => client.close();
  const pubsub = new InMemoryPubSub();
  const d = { db, pubsub, rng: makeRng(3) };
  for (const u of ['host', 'guest', 'stranger']) await upsertUser(db as any, { id: u, displayName: u });
  const m = await createMatch(db as any, { createdBy: 'host', seats: 3, joinCode: 'L1' });
  await addPlayer(db as any, { matchId: m.id, userId: 'host', seatIndex: 0 });
  await addPlayer(db as any, { matchId: m.id, userId: 'guest', seatIndex: 1 });
  if (status === 'active') await (db as any).update(matches).set({ status: 'active' }).where(eq(matches.id, m.id));
  return { db, d, pubsub, matchId: m.id };
}

describe('leaveLobby', () => {
  it('lets a seated guest leave a table that has not been dealt', async () => {
    const { db, d, pubsub, matchId } = await setup();
    const msgs: unknown[] = [];
    await pubsub.subscribe('match:' + matchId, (m) => { msgs.push(m); });
    const res = await leaveLobby(d as any, { matchId, userId: 'guest' });
    expect(res.ok).toBe(true);
    expect((await listPlayers(db as any, matchId)).map((p) => p.userId)).toEqual(['host']);
    expect(msgs).toEqual([{ type: 'lobby', matchId }]);
  });

  it('refuses the host (the host deletes the table instead)', async () => {
    const { d, matchId } = await setup();
    expect((await leaveLobby(d as any, { matchId, userId: 'host' })).ok).toBe(false);
  });

  it('refuses someone who is not seated', async () => {
    const { d, matchId } = await setup();
    expect((await leaveLobby(d as any, { matchId, userId: 'stranger' })).ok).toBe(false);
  });

  it('refuses once the game has been dealt', async () => {
    const { d, matchId } = await setup('active');
    expect((await leaveLobby(d as any, { matchId, userId: 'guest' })).ok).toBe(false);
  });
});

describe('leaving vs dealing at the same moment', () => {
  it('never deals a game with an empty chair', async () => {
    const { db, d, matchId } = await setup();
    await upsertUser(db as any, { id: 'third', displayName: 'third' });
    await addPlayer(db as any, { matchId, userId: 'third', seatIndex: 2 });
    const { startGame } = await import('../matches');
    const [dealt, left] = await Promise.all([
      startGame(d as any, { matchId, userId: 'host' }),
      leaveLobby(d as any, { matchId, userId: 'guest' }),
    ]);
    const seated = await listPlayers(db as any, matchId);
    const [m] = await (db as any).select().from(matches).where(eq(matches.id, matchId));
    // Exactly one of them wins, and the table is consistent either way.
    expect(dealt.ok !== left.ok).toBe(true);
    if (dealt.ok) { expect(m.status).toBe('active'); expect(seated).toHaveLength(3); }
    else { expect(m.status).toBe('lobby'); expect(seated).toHaveLength(2); }
  });

  it('removes nobody once the table has been dealt (the delete itself checks)', async () => {
    const { db, matchId } = await setup('active');
    const { removePlayer } = await import('../../db/repositories/players');
    expect(await removePlayer(db as any, matchId, 'guest')).toBe(false);
    expect(await listPlayers(db as any, matchId)).toHaveLength(2);
  });
});
