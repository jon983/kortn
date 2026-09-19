import { describe, it, expect, afterEach, vi } from 'vitest';

// Mock '../../db' so saveGameState throws OptimisticLockError once, then delegates.
vi.mock('../../db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../db')>();
  let calls = 0;
  return {
    ...actual,
    saveGameState: vi.fn(async (...args: Parameters<typeof actual.saveGameState>) => {
      calls++;
      if (calls === 1) throw new actual.OptimisticLockError('forced conflict');
      return actual.saveGameState(...args);
    }),
  };
});

import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby, joinLobby, startGame } from '../matches';
import { submitAction } from '../runtime';
import { getMatch, loadGameState } from '../../db';
import { makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('submitAction conflict recovery', () => {
  it('recovers from a forced OptimisticLockError by reloading and retrying', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = { db, pubsub: new InMemoryPubSub(), rng: makeRng(3) };
    const { matchId } = await createLobby(d as any, { userId: 'u1', displayName: 'A', seats: 2 });
    await joinLobby(d as any, { userId: 'u2', displayName: 'B', joinCode: (await getMatch(db as any, matchId))!.joinCode });
    await startGame(d as any, { matchId, userId: 'u1' });

    const before = await loadGameState(db as any, matchId);
    const actingUser = before!.state.round.turn === 0 ? 'u1' : 'u2';

    const res = await submitAction(d as any, { matchId, userId: actingUser, action: { type: 'draw', source: 'stock' } });
    expect(res.ok).toBe(true); // first save threw, retry succeeded
    const after = await loadGameState(db as any, matchId);
    expect(after!.version).toBe(before!.version + 1);
  });
});
