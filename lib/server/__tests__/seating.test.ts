import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby, joinLobby, startGame } from '../matches';
import { listPlayers, getMatch } from '../../db';
import { makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });
const deps = (db: any, seed = 5) => ({ db, pubsub: new InMemoryPubSub(), rng: makeRng(seed) });

describe('randomised seating', () => {
  it('assigns every player a unique seat covering 0..n-1 (a permutation)', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = deps(db, 7);
    const { matchId } = await createLobby(d as any, { userId: 'u1', displayName: 'A', seats: 4 });
    for (const u of ['u2', 'u3', 'u4']) {
      await joinLobby(d as any, { userId: u, displayName: u, joinCode: (await getMatch(db as any, matchId))!.joinCode });
    }
    await startGame(d as any, { matchId, userId: 'u1' });

    const players = await listPlayers(db as any, matchId);
    const seats = players.map((p) => p.seatIndex).sort();
    expect(seats).toEqual([0, 1, 2, 3]);                 // permutation, all seats covered
    expect(new Set(players.map((p) => p.userId)).size).toBe(4); // every user present exactly once

    // with this seed the shuffle must differ from join order for at least one seat
    const joinOrder = ['u1', 'u2', 'u3', 'u4'];
    const bySeat = [...players].sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.userId);
    expect(bySeat).not.toEqual(joinOrder);
  });
});
