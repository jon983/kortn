import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../db/__tests__/helpers';
import { InMemoryPubSub } from '../pubsub';
import { finishRoundTransition, submitAction } from '../runtime';
import { upsertUser, createMatch, addPlayer, initGameState, loadGameState, recordRound as _rr } from '../../db';
import { users, matches as matchesTable } from '../../db/schema';
import { startMatch, makeRng, type MatchState } from '../../kalooki';

function mkDeps(db: any) { return { db, pubsub: new InMemoryPubSub(), rng: makeRng(7) }; }
let close: (() => Promise<void>) | null = null;
afterEach(async () => { if (close) await close(); close = null; });

// Build a finished-round MatchState: seat 0 went out (empty hand), seat 1 holds cards.
function finishedRoundState(): MatchState {
  const s = startMatch({ seats: 2, seed: 1 });
  const round = {
    ...s.round,
    players: [
      { seat: 0, hand: [], hasOpened: true },
      { seat: 1, hand: [{ id: 'A-clubs-9', kind: 'natural', rank: 9, suit: 'clubs', pack: 'A' } as any], hasOpened: true },
    ],
    finished: true, winnerSeat: 0, goOutType: 'normal' as const,
    turnStartHandSize: 2, openedAtTurnStart: true,
  };
  return { ...s, round };
}

describe('finishRoundTransition', () => {
  it('settles a normal round, then deals the next hand once both players are ready', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T1' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    const state = finishedRoundState();
    await initGameState(db as any, m.id, state);

    // settle → pause on the finished hand (scorecard shows), no next round yet
    const paused = await finishRoundTransition(d, m.id, state);
    expect(paused.scores).toEqual([0, 9]);       // seat 1 held a 9 → +9
    expect(paused.round.finished).toBe(true);
    expect(paused.roundNumber).toBe(1);          // not advanced yet
    expect(paused.finished).toBe(false);

    // one player ready → still paused
    await submitAction(d, { matchId: m.id, userId: 'u1', action: { type: 'readyNext' } });
    let persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.roundNumber).toBe(1);

    // both ready → next hand dealt
    const res = await submitAction(d, { matchId: m.id, userId: 'u2', action: { type: 'readyNext' } });
    expect(res.ok).toBe(true);
    persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.roundNumber).toBe(2);
    expect(persisted!.state.round.players[0].hand).toHaveLength(13);
    expect(persisted!.state.finished).toBe(false);
  });

  it('ends a 2-player match as soon as a player busts — no click needed — and pays out the pot', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T2' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    // seat 1 already at 145, will bust with +9 -> 154 > 150; nobody left to rebuy against
    const state = finishedRoundState();
    state.scores = [0, 145];
    await initGameState(db as any, m.id, state);

    const done = await finishRoundTransition(d, m.id, state);
    expect(done.finished).toBe(true);
    expect(done.winnerSeat).toBe(0);
    // hand: seat 1 pays 1 bit; match: both ante 4, winner takes the pot of 8
    expect(done.payout).toEqual([4, -4]);
    expect(done.bits).toEqual([5, -5]);

    const persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.finished).toBe(true);
    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, m.id));
    expect(row.status).toBe('finished');
    expect(row.winnerUserId).toBe('u1');
  });

  it('3 players: a bust with two still in pauses for the rebuy decision', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    for (const u of ['u1', 'u2', 'u3']) await upsertUser(db as any, { id: u, displayName: u });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 3, joinCode: 'T4' });
    for (const [i, u] of ['u1', 'u2', 'u3'].entries()) await addPlayer(db as any, { matchId: m.id, userId: u, seatIndex: i });

    const s = startMatch({ seats: 3, seed: 1 });
    const nine = { id: 'A-clubs-9', kind: 'natural', rank: 9, suit: 'clubs', pack: 'A' } as any;
    const state: MatchState = {
      ...s,
      scores: [0, 145, 20],
      round: {
        ...s.round,
        players: [
          { seat: 0, hand: [], hasOpened: true },
          { seat: 1, hand: [nine], hasOpened: true },
          { seat: 2, hand: [], hasOpened: true },
        ],
        finished: true, winnerSeat: 0, goOutType: 'normal' as const,
      },
    };
    await initGameState(db as any, m.id, state);

    const paused = await finishRoundTransition(d, m.id, state);
    expect(paused.finished).toBe(false);
    expect(paused.statuses[1]).toBe('busted');
    expect(paused.rebought[1]).toBe(false);

    const res = await submitAction(d, { matchId: m.id, userId: 'u2', action: { type: 'rebuy' } });
    expect(res.ok).toBe(true);
    const persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.statuses[1]).toBe('active');
    expect(persisted!.state.boughtBack?.[1]).toBe(true);
    expect(persisted!.state.pot).toBe(16);
  });

  it('refuses a rebuy when too few players remain', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T5' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });
    const base = startMatch({ seats: 2, seed: 1 });
    await initGameState(db as any, m.id, { ...base, statuses: ['active', 'busted'], scores: [0, 154] });

    const res = await submitAction(d, { matchId: m.id, userId: 'u2', action: { type: 'rebuy' } });
    expect(res.ok).toBe(false);
  });

  it('all-decline match-end awards gamesPlayed to every player', async () => {
    const { db, client } = await makeTestDb();
    close = () => client.close();
    const d = mkDeps(db);
    await upsertUser(db as any, { id: 'u1', displayName: 'A' });
    await upsertUser(db as any, { id: 'u2', displayName: 'B' });
    const m = await createMatch(db as any, { createdBy: 'u1', seats: 2, joinCode: 'T3' });
    await addPlayer(db as any, { matchId: m.id, userId: 'u1', seatIndex: 0 });
    await addPlayer(db as any, { matchId: m.id, userId: 'u2', seatIndex: 1 });

    // seat 1 is already busted and has not yet decided; seat 0 stays active.
    const base = startMatch({ seats: 2, seed: 1 });
    const state: MatchState = {
      ...base,
      statuses: ['active', 'busted'],
      rebought: [false, false],
      scores: [0, 154],
    };
    await initGameState(db as any, m.id, state);

    // seat 1's user declines -> no seat pending -> only seat 0 active -> match ends
    const res = await submitAction(d, { matchId: m.id, userId: 'u2', action: { type: 'decline' } });
    expect(res.ok).toBe(true);

    const persisted = await loadGameState(db as any, m.id);
    expect(persisted!.state.finished).toBe(true);
    expect(persisted!.state.winnerSeat).toBe(0);

    const [u1] = await db.select().from(users).where(eq(users.id, 'u1'));
    const [u2] = await db.select().from(users).where(eq(users.id, 'u2'));
    expect(u1.gamesPlayed).toBe(1);
    expect(u2.gamesPlayed).toBe(1);
  });
});
