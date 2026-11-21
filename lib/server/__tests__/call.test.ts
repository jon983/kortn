import { describe, it, expect, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../db/__tests__/helpers';
import { getCallCredentials } from '../call';
import { upsertUser, createMatch, addPlayer } from '../../db';
import { matches } from '../../db/schema';
import type { DailyClient } from '../daily';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

function fakeDaily(): DailyClient & { tokens: unknown[] } {
  const tokens: unknown[] = [];
  return {
    tokens,
    getOrCreateRoom: vi.fn(async (name: string) => ({ name, url: `https://x.daily.co/${name}` })),
    createToken: vi.fn(async (p) => { tokens.push(p); return 'TOK'; }),
  };
}

async function setup(status: 'lobby' | 'active') {
  const { db, client } = await makeTestDb();
  close = () => client.close();
  for (const u of ['u1', 'u2', 'u3']) await upsertUser(db as any, { id: u, displayName: u });
  const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'C1' });
  await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
  await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });
  if (status === 'active') await (db as any).update(matches).set({ status: 'active' }).where(eq(matches.id, m.id));
  return { db, matchId: m.id };
}

describe('getCallCredentials', () => {
  it('gives a seated player a token for their game’s room, tagged with their seat', async () => {
    const { db, matchId } = await setup('active');
    const daily = fakeDaily();
    const now = 1_000_000;
    const res = await getCallCredentials({ db: db as any, daily, now: () => now * 1000 }, { matchId, userId: 'u2', displayName: 'Ines' });
    expect(res).toEqual({ ok: true, url: `https://x.daily.co/kortn-${matchId.replace(/-/g, '')}`, token: 'TOK' });
    expect(daily.tokens[0]).toMatchObject({ userId: 'seat-1', userName: 'Ines', roomName: `kortn-${matchId.replace(/-/g, '')}` });
    expect((daily.tokens[0] as { exp: number }).exp).toBeGreaterThan(now);
  });

  it('refuses someone who is not seated in the game', async () => {
    const { db, matchId } = await setup('active');
    const daily = fakeDaily();
    const res = await getCallCredentials({ db: db as any, daily }, { matchId, userId: 'u3', displayName: 'X' });
    expect(res.ok).toBe(false);
    expect(daily.createToken).not.toHaveBeenCalled();
  });

  it('refuses a game that is not in play', async () => {
    const { db, matchId } = await setup('lobby');
    const res = await getCallCredentials({ db: db as any, daily: fakeDaily() }, { matchId, userId: 'u1', displayName: 'A' });
    expect(res.ok).toBe(false);
  });
});
