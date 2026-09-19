import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from '../../db/__tests__/helpers';
import { upsertUser, createMatch, addPlayer } from '../../db';
import { resolveSeat } from '../seats';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('resolveSeat', () => {
  it('returns the seat a user holds, or null', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'S1' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    expect(await resolveSeat(db as any, m.id, 'u2')).toBe(1);
    expect(await resolveSeat(db as any, m.id, 'nobody')).toBeNull();
  });
});
