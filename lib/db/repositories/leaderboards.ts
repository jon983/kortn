import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { matchPlayers, rounds, gameStates, users } from '../schema';
import { aggregateHands, rankLeaderboards, type MatchHands, type HandAggregate, type Leaderboards } from '../../stats/hands';

/** Every recorded hand, grouped by match, with seat→player and the scorepad where present. */
export async function loadMatchHands(db: DB, opts?: { userId?: string }): Promise<MatchHands[]> {
  let matchIds: string[] | null = null;
  if (opts?.userId) {
    const mine = await db.select({ id: matchPlayers.matchId }).from(matchPlayers).where(eq(matchPlayers.userId, opts.userId));
    matchIds = mine.map((r) => r.id);
    if (matchIds.length === 0) return [];
  }
  const within = <T>(col: T) => (matchIds ? inArray(col as never, matchIds) : undefined);

  const [roundRows, playerRows, historyRows] = await Promise.all([
    db.select({
      matchId: rounds.matchId, roundNumber: rounds.roundNumber, winnerSeat: rounds.winnerSeat,
      goOutType: rounds.goOutType, scores: rounds.scores,
    }).from(rounds).where(within(rounds.matchId)).orderBy(asc(rounds.matchId), asc(rounds.roundNumber)),
    db.select({ matchId: matchPlayers.matchId, userId: matchPlayers.userId, seat: matchPlayers.seatIndex, name: users.displayName })
      .from(matchPlayers).innerJoin(users, eq(users.id, matchPlayers.userId)).where(within(matchPlayers.matchId)),
    db.select({ matchId: gameStates.matchId, history: sql<MatchHands['history'] | null>`${gameStates.state} -> 'history'` })
      .from(gameStates).where(within(gameStates.matchId)),
  ]);

  const byMatch = new Map<string, MatchHands>();
  const entry = (id: string) => {
    let m = byMatch.get(id);
    if (!m) { m = { players: [], rounds: [] }; byMatch.set(id, m); }
    return m;
  };
  for (const r of roundRows) entry(r.matchId).rounds.push(r);
  for (const p of playerRows) entry(p.matchId).players.push({ userId: p.userId, name: p.name, seat: p.seat });
  for (const h of historyRows) if (h.history && byMatch.has(h.matchId)) entry(h.matchId).history = h.history;
  return [...byMatch.values()].filter((m) => m.rounds.length > 0);
}

export async function getHandAggregates(db: DB): Promise<Map<string, HandAggregate>> {
  return aggregateHands(await loadMatchHands(db));
}

export function leaderboardsFrom(agg: Map<string, HandAggregate>, opts?: { minHands?: number; limit?: number }): Leaderboards {
  return rankLeaderboards(agg, { minHands: opts?.minHands ?? 1, limit: opts?.limit ?? 10 });
}
