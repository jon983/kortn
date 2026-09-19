import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby, joinLobby, startGame } from '../matches';
import { loadGameState, listPlayers, getMatch } from '../../db';
import { makeRng } from '../../kalooki';

function deps(db: any) {
  return { db, pubsub: new InMemoryPubSub(), rng: makeRng(99) };
}
let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('match lifecycle', () => {
  it('creates a lobby, joins it, and starts the game', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = deps(db);

    const { matchId } = await createLobby(d, { userId: 'u1', displayName: 'A', seats: 2 });
    await joinLobby(d, { userId: 'u2', displayName: 'B', joinCode: (await getMatch(db as any, matchId))!.joinCode });

    const players = await listPlayers(db as any, matchId);
    expect(players.map((p) => p.seatIndex)).toEqual([0, 1]);

    const res = await startGame(d, { matchId, userId: 'u1' });
    expect(res.ok).toBe(true);

    const loaded = await loadGameState(db as any, matchId);
    expect(loaded?.version).toBe(0);
    expect(loaded?.state.pot).toBe(8); // 2 seats * 4
    expect(loaded?.state.round.players[0].hand).toHaveLength(13);
    expect((await getMatch(db as any, matchId))?.status).toBe('active');
  });

  it('rejects starting by a non-creator', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = deps(db);
    const { matchId } = await createLobby(d, { userId: 'u1', displayName: 'A', seats: 2 });
    await joinLobby(d, { userId: 'u2', displayName: 'B', joinCode: (await getMatch(db as any, matchId))!.joinCode });
    const res = await startGame(d, { matchId, userId: 'u2' });
    expect(res.ok).toBe(false);
  });
});
