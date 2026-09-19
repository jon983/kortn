import { describe, it, expect, afterEach, vi } from 'vitest';

// Mock '../../db' so saveGameState throws OptimisticLockError once on its first call,
// then delegates to the real implementation. This mirrors runtime-conflict.test.ts.
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

import { eq, sql } from 'drizzle-orm';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby, joinLobby, startGame } from '../matches';
import { submitAction } from '../runtime';
import { getMatch, loadGameState } from '../../db';
import { gameStates } from '../../db/schema';
import { makeRng, type MatchState } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  if (close) await close();
  close = null;
});

describe('submitAction rebuy/decline conflict recovery', () => {
  it('retries on OptimisticLockError during rebuy and still succeeds', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = { db, pubsub: new InMemoryPubSub(), rng: makeRng(42) };

    const { matchId } = await createLobby(d as any, { userId: 'u1', displayName: 'A', seats: 2 });
    await joinLobby(d as any, {
      userId: 'u2',
      displayName: 'B',
      joinCode: (await getMatch(db as any, matchId))!.joinCode,
    });
    await startGame(d as any, { matchId, userId: 'u1' });

    // Patch the live state to have seat 0 busted.
    // Use db.update directly (not saveGameState) so it bypasses the mock,
    // keeping the mock call counter at 0 for the submitAction call below.
    const loaded = await loadGameState(db as any, matchId);
    expect(loaded).not.toBeNull();
    const bustedState: MatchState = {
      ...loaded!.state,
      statuses: ['busted', loaded!.state.statuses[1]],
      rebought: [false, loaded!.state.rebought[1]],
    };
    await (db as any).update(gameStates)
      .set({ state: bustedState, version: loaded!.version, updatedAt: sql`now()` })
      .where(eq(gameStates.matchId, matchId));

    // Now the FIRST saveGameState call is from submitAction rebuy path → throws OLE
    // The second call → succeeds via the real implementation
    const res = await submitAction(d as any, {
      matchId,
      userId: 'u1',
      action: { type: 'rebuy' },
    });

    expect(res.ok).toBe(true); // first save threw, retry succeeded
  }, 15000);
});
