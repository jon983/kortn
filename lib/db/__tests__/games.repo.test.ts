import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb } from './helpers';
import { upsertUser } from '../repositories/users';
import { createMatch } from '../repositories/matches';
import { initGameState, loadGameState, saveGameState, appendMove, listMoves } from '../repositories/games';
import { OptimisticLockError } from '../errors';
import { startMatch, applyAction, makeRng } from '../../kalooki';

let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

async function seed(db: any) {
  await upsertUser(db, { id: 'u1', displayName: 'A' });
  const m = await createMatch(db, { createdBy: 'u1', seats: 2, joinCode: 'G1' });
  return m.id as string;
}

describe('game-state repository', () => {
  it('inits, loads, and saves state with an incrementing version', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);

    const s0 = startMatch({ seats: 2, seed: 5 });
    await initGameState(db as any, matchId, s0);

    const loaded = await loadGameState(db as any, matchId);
    expect(loaded?.version).toBe(0);
    expect(loaded?.state.round.players).toHaveLength(2);

    // apply one legal action, then save at the expected version
    const seat = s0.round.turn;
    const res = applyAction(s0, seat, { type: 'draw', source: 'stock' }, makeRng(1));
    if (!res.ok) throw new Error('setup action failed');
    const newVersion = await saveGameState(db as any, matchId, 0, res.match);
    expect(newVersion).toBe(1);
    expect((await loadGameState(db as any, matchId))?.version).toBe(1);
  });

  it('rejects a save at a stale version (optimistic lock)', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    const s0 = startMatch({ seats: 2, seed: 5 });
    await initGameState(db as any, matchId, s0);
    await saveGameState(db as any, matchId, 0, s0); // version -> 1
    await expect(saveGameState(db as any, matchId, 0, s0)).rejects.toBeInstanceOf(OptimisticLockError);
  });

  it('appends moves and lists them in sequence order', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const matchId = await seed(db);
    await appendMove(db as any, { matchId, roundNumber: 1, seatIndex: 0, sequence: 2, action: { type: 'discard', cardId: 'A-clubs-5' } });
    await appendMove(db as any, { matchId, roundNumber: 1, seatIndex: 0, sequence: 1, action: { type: 'draw', source: 'stock' } });
    const rows = await listMoves(db as any, matchId);
    expect(rows.map((r) => r.sequence)).toEqual([1, 2]);
    expect(rows[1].action).toEqual({ type: 'discard', cardId: 'A-clubs-5' });
  });
});
