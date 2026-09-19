import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { users, matches, gameStates, moves, rounds } from '../schema';
import { eq } from 'drizzle-orm';
import { startMatch } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seedMatch(db: any) {
  await db.insert(users).values({ id: 'u1', displayName: 'A' });
  const [m] = await db.insert(matches).values({ createdBy: 'u1', seats: 2, joinCode: 'JC01' }).returning();
  return m.id as string;
}

describe('game schema', () => {
  it('stores a full engine MatchState as jsonb and reads it back intact', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seedMatch(db);

    const state = startMatch({ seats: 2, seed: 7 });
    await db.insert(gameStates).values({ matchId, state, version: 0 });

    const [row] = await db.select().from(gameStates).where(eq(gameStates.matchId, matchId));
    expect(row.version).toBe(0);
    expect(row.state.seats).toBe(2);
    expect(row.state.round.players).toHaveLength(2);
    // round-trip fidelity of a nested field
    expect(row.state.round.players[0].hand).toHaveLength(13);
  });

  it('stores a move with a jsonb action and enforces unique sequence', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seedMatch(db);

    await db.insert(moves).values({
      matchId, roundNumber: 1, seatIndex: 0, sequence: 1,
      action: { type: 'draw', source: 'stock' },
    });
    const rows = await db.select().from(moves).where(eq(moves.matchId, matchId));
    expect(rows[0].action).toEqual({ type: 'draw', source: 'stock' });
    await expect(
      db.insert(moves).values({ matchId, roundNumber: 1, seatIndex: 1, sequence: 1, action: { type: 'draw', source: 'stock' } }),
    ).rejects.toThrow();
  });

  it('records a round with a unique (matchId, roundNumber)', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seedMatch(db);
    await db.insert(rounds).values({ matchId, roundNumber: 1, dealerSeat: 0, winnerSeat: 1, goOutType: 'normal', scores: [0, 19] });
    const [r] = await db.select().from(rounds).where(eq(rounds.matchId, matchId));
    expect(r.scores).toEqual([0, 19]);
    expect(r.goOutType).toBe('normal');
  });
});
