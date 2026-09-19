import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { createLobby } from '../matches';
import { makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });
const deps = (db: any) => ({ db, pubsub: new InMemoryPubSub(), rng: makeRng(1) });

describe('createLobby seat validation', () => {
  it('accepts 2..5 and rejects outside', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const ok = await createLobby(deps(db) as any, { userId: 'u1', displayName: 'A', seats: 5 });
    expect(ok.matchId).toBeTruthy();
    await expect(createLobby(deps(db) as any, { userId: 'u1', displayName: 'A', seats: 6 })).rejects.toThrow();
    await expect(createLobby(deps(db) as any, { userId: 'u1', displayName: 'A', seats: 1 })).rejects.toThrow();
  });
});
