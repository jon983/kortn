import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { createMatch } from '../repositories/matches';
import { recordRound } from '../repositories/rounds';
import { rounds } from '../schema';
import { eq } from 'drizzle-orm';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

describe('rounds repository', () => {
  it('records a finished round', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'R1' });

    await recordRound(db as any, {
      matchId: m.id, roundNumber: 1, dealerSeat: 0, winnerSeat: 1, goOutType: 'kalooki', scores: [17, 0],
    });
    const [r] = await db.select().from(rounds).where(eq(rounds.matchId, m.id));
    expect(r.winnerSeat).toBe(1);
    expect(r.goOutType).toBe('kalooki');
    expect(r.scores).toEqual([17, 0]);
  });
});
