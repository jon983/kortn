import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { endMatch } from '../matches';
import { upsertUser, createMatch, addPlayer, initGameState, loadGameState, getUserStats } from '../../db';
import { matches } from '../../db/schema';
import { startMatch, makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function setup(status: 'lobby' | 'active' = 'active') {
  const { db, client } = await makeTestDb();
  close = () => client.close();
  const pubsub = new InMemoryPubSub();
  const d = { db, pubsub, rng: makeRng(3) };
  for (const u of ['u1', 'u2', 'u3']) await upsertUser(db as any, { id: u, displayName: u });
  const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'E1' });
  await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
  await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });
  if (status === 'active') {
    await initGameState(db as any, m.id, { ...startMatch({ seats: 2, seed: 1 }), bits: [3, -3] });
    await (db as any).update(matches).set({ status: 'active' }).where(eq(matches.id, m.id));
  }
  return { db, d, pubsub, matchId: m.id };
}

describe('endMatch (abandon a game)', () => {
  it('any player can end an active game: abandoned, no winner, no pot paid, hand bits stand', async () => {
    const { db, d, pubsub, matchId } = await setup();
    const published: unknown[] = [];
    await pubsub.subscribe('match:' + matchId, (msg) => { published.push(msg); });

    const res = await endMatch(d as any, { matchId, userId: 'u2' }); // not the host
    expect(res.ok).toBe(true);

    const [row] = await db.select().from(matches).where(eq(matches.id, matchId));
    expect(row.status).toBe('abandoned');
    expect(row.winnerUserId).toBeNull();
    expect(row.finishedAt).not.toBeNull();

    const st = (await loadGameState(db as any, matchId))!.state;
    expect(st.finished).toBe(true);
    expect(st.abandoned).toBe(true);
    expect(st.winnerSeat).toBeNull();
    expect(st.payout).toBeUndefined();
    expect(st.bits).toEqual([3, -3]);
    expect(published).toHaveLength(1);

    // Not a played game, but its hand bits count toward net bits.
    const s1 = await getUserStats(db as any, 'u1');
    expect(s1.gamesPlayed).toBe(0);
    expect(s1.netBits).toBe(3);
  });

  it('refuses someone who is not in the game', async () => {
    const { d, matchId } = await setup();
    const res = await endMatch(d as any, { matchId, userId: 'u3' });
    expect(res.ok).toBe(false);
  });

  it('refuses a game that has already finished', async () => {
    const { db, d, matchId } = await setup();
    await (db as any).update(matches).set({ status: 'finished' }).where(eq(matches.id, matchId));
    const res = await endMatch(d as any, { matchId, userId: 'u1' });
    expect(res.ok).toBe(false);
  });

  it('can end a game still in the lobby', async () => {
    const { db, d, matchId } = await setup('lobby');
    const res = await endMatch(d as any, { matchId, userId: 'u2' });
    expect(res.ok).toBe(true);
    const [row] = await db.select().from(matches).where(eq(matches.id, matchId));
    expect(row.status).toBe('abandoned');
  });
});
