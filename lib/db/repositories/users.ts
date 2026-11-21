import { eq, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { users, matches, matchPlayers, gameStates } from '../schema';
import { aggregateHands, type HandAggregate } from '../../stats/hands';
import { loadMatchHands } from './leaderboards';

export interface UpsertUserInput {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface UserStatsDelta {
  gamesPlayed?: number;
  roundsWon?: number;
  bitsNet?: number;
}

export async function incrementUserStats(db: DB, userId: string, delta: UserStatsDelta): Promise<void> {
  const setObj: Record<string, unknown> = {};
  if (delta.gamesPlayed !== undefined) setObj.gamesPlayed = sql`${users.gamesPlayed} + ${delta.gamesPlayed}`;
  if (delta.roundsWon !== undefined) setObj.roundsWon = sql`${users.roundsWon} + ${delta.roundsWon}`;
  if (delta.bitsNet !== undefined) setObj.bitsNet = sql`${users.bitsNet} + ${delta.bitsNet}`;
  if (Object.keys(setObj).length === 0) return;
  await db.update(users).set(setObj).where(eq(users.id, userId));
}

export interface UserStats {
  gamesPlayed: number;   // finished matches you were in
  gamesWon: number;
  winRate: number;       // gamesWon / gamesPlayed (0..1)
  roundsWon: number;
  /** Rounds you'd expect to win by chance (sum of 1/players over rounds played). */
  parWins: number;
  /** roundsWon / parWins — >1 means you win more hands than chance. null if no data. */
  vsPar: number | null;
  /** Average points taken per finished round (lower is better). null if no data. */
  avgPointsPerRound: number | null;
  netBits: number;
  kalookis: number;
  treasures: number;
  potWinnings: number;   // total pot bits from matches you won
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/** Pass `hands` (or null for none) when the caller already aggregated them; otherwise they're loaded. */
export async function getUserStats(db: DB, userId: string, hands?: HandAggregate | null): Promise<UserStats> {
  // Hand-level stats come from the shared aggregate (same numbers as the leaderboards).
  const h = hands !== undefined ? hands : aggregateHands(await loadMatchHands(db, { userId })).get(userId);

  // Match-level aggregates (finished matches; bits/points pulled from game state).
  const [m] = await db
    .select({
      gamesPlayed: sql<number>`count(*) filter (where ${matches.status} = 'finished')`,
      gamesWon: sql<number>`count(*) filter (where ${matches.winnerUserId} = ${userId})`,
      // Abandoned games count too: their hand-by-hand bits stand (no pot was paid).
      netBits: sql<number>`coalesce(sum((${gameStates.state} -> 'bits' ->> ${matchPlayers.seatIndex})::int) filter (where ${matches.status} in ('finished', 'abandoned')), 0)`,
      totalPoints: sql<number>`coalesce(sum((${gameStates.state} -> 'scores' ->> ${matchPlayers.seatIndex})::int) filter (where ${matches.status} = 'finished'), 0)`,
      potWinnings: sql<number>`coalesce(sum((${gameStates.state} ->> 'pot')::int) filter (where ${matches.winnerUserId} = ${userId}), 0)`,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .leftJoin(gameStates, eq(gameStates.matchId, matchPlayers.matchId))
    .where(eq(matchPlayers.userId, userId));

  const gamesPlayed = n(m?.gamesPlayed);
  const gamesWon = n(m?.gamesWon);
  const roundsWon = h?.wins ?? 0;
  const parWins = h?.parWins ?? 0;
  return {
    gamesPlayed,
    gamesWon,
    winRate: gamesPlayed > 0 ? gamesWon / gamesPlayed : 0,
    roundsWon,
    parWins,
    vsPar: parWins > 0 ? roundsWon / parWins : null,
    avgPointsPerRound: h && h.pointHands > 0 ? h.points / h.pointHands : null,
    netBits: n(m?.netBits),
    kalookis: h?.kalookis ?? 0,
    treasures: h?.treasures ?? 0,
    potWinnings: n(m?.potWinnings),
  };
}

export async function upsertUser(db: DB, input: UpsertUserInput): Promise<void> {
  await db
    .insert(users)
    .values({ id: input.id, displayName: input.displayName, avatarUrl: input.avatarUrl ?? null })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: input.displayName,
        // Only touch the avatar when the caller knows it (create/join pass just a name).
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        updatedAt: sql`now()`,
      },
    });
}
