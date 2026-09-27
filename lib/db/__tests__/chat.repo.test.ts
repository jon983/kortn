import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { createMatch } from '../repositories/matches';
import { addChatMessage, listRecentChatMessages } from '../repositories/chat';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('chat repository', () => {
  it('adds messages and lists them oldest-first', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'CH1' });

    await addChatMessage(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0, body: 'hello' });
    await addChatMessage(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0, body: 'again' });

    const msgs = await listRecentChatMessages(db as any, m.id);
    expect(msgs.map((x) => x.body)).toEqual(['hello', 'again']);
    expect(msgs[0].seatIndex).toBe(0);
  });

  it('caps to the most recent N, keeping oldest-first order', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'CH2' });
    for (let i = 0; i < 5; i++) {
      await addChatMessage(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0, body: `m${i}` });
    }
    const msgs = await listRecentChatMessages(db as any, m.id, 3);
    expect(msgs.map((x) => x.body)).toEqual(['m2', 'm3', 'm4']);
  });
});
