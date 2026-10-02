import { eq, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { users, matches, matchPlayers, rounds, gameStates } from '../schema';

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

export async function getUserStats(db: DB, userId: string): Promise<UserStats> {
  // Round-level aggregates (over every round in your matches).
  const [r] = await db
    .select({
      roundsAll: sql<number>`count(*)`,
      roundsFinished: sql<number>`count(*) filter (where ${matches.status} = 'finished')`,
      parWins: sql<number>`coalesce(sum(1.0 / ${matches.seats}), 0)`,
      roundsWon: sql<number>`count(*) filter (where ${rounds.winnerSeat} = ${matchPlayers.seatIndex})`,
      kalookis: sql<number>`count(*) filter (where ${rounds.winnerSeat} = ${matchPlayers.seatIndex} and ${rounds.goOutType} = 'kalooki')`,
      treasures: sql<number>`count(*) filter (where ${rounds.winnerSeat} = ${matchPlayers.seatIndex} and ${rounds.goOutType} = 'treasure')`,
    })
    .from(rounds)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, rounds.matchId))
    .innerJoin(matches, eq(matches.id, rounds.matchId))
    .where(eq(matchPlayers.userId, userId));

  // Match-level aggregates (finished matches; bits/points pulled from game state).
  const [m] = await db
    .select({
      gamesPlayed: sql<number>`count(*) filter (where ${matches.status} = 'finished')`,
      gamesWon: sql<number>`count(*) filter (where ${matches.winnerUserId} = ${userId})`,
      netBits: sql<number>`coalesce(sum((${gameStates.state} -> 'bits' ->> ${matchPlayers.seatIndex})::int) filter (where ${matches.status} = 'finished'), 0)`,
      totalPoints: sql<number>`coalesce(sum((${gameStates.state} -> 'scores' ->> ${matchPlayers.seatIndex})::int) filter (where ${matches.status} = 'finished'), 0)`,
      potWinnings: sql<number>`coalesce(sum((${gameStates.state} ->> 'pot')::int) filter (where ${matches.winnerUserId} = ${userId}), 0)`,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .leftJoin(gameStates, eq(gameStates.matchId, matchPlayers.matchId))
    .where(eq(matchPlayers.userId, userId));

  const gamesPlayed = n(m?.gamesPlayed);
  const gamesWon = n(m?.gamesWon);
  const roundsWon = n(r?.roundsWon);
  const parWins = n(r?.parWins);
  const roundsFinished = n(r?.roundsFinished);
  const totalPoints = n(m?.totalPoints);
  return {
    gamesPlayed,
    gamesWon,
    winRate: gamesPlayed > 0 ? gamesWon / gamesPlayed : 0,
    roundsWon,
    parWins,
    vsPar: parWins > 0 ? roundsWon / parWins : null,
    avgPointsPerRound: roundsFinished > 0 ? totalPoints / roundsFinished : null,
    netBits: n(m?.netBits),
    kalookis: n(r?.kalookis),
    treasures: n(r?.treasures),
    potWinnings: n(m?.potWinnings),
  };
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  roundsWon: number;
  parWins: number;
  vsPar: number;
  roundsPlayed: number;
}

/** Players ranked by hand-win rate vs par (roundsWon / expected-by-chance). */
export async function getVsParLeaderboard(
  db: DB,
  opts?: { minRounds?: number; limit?: number },
): Promise<LeaderboardEntry[]> {
  const minRounds = opts?.minRounds ?? 1;
  const limit = opts?.limit ?? 10;
  const rows = await db
    .select({
      userId: matchPlayers.userId,
      name: users.displayName,
      roundsWon: sql<number>`count(*) filter (where ${rounds.winnerSeat} = ${matchPlayers.seatIndex})`,
      parWins: sql<number>`coalesce(sum(1.0 / ${matches.seats}), 0)`,
      roundsPlayed: sql<number>`count(*)`,
    })
    .from(rounds)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, rounds.matchId))
    .innerJoin(matches, eq(matches.id, rounds.matchId))
    .innerJoin(users, eq(users.id, matchPlayers.userId))
    .groupBy(matchPlayers.userId, users.displayName)
    .having(sql`count(*) >= ${minRounds}`)
    .orderBy(sql`count(*) filter (where ${rounds.winnerSeat} = ${matchPlayers.seatIndex}) / nullif(sum(1.0 / ${matches.seats}), 0) desc nulls last`)
    .limit(limit);
  return rows.map((row) => {
    const parWins = n(row.parWins);
    return {
      userId: row.userId,
      name: row.name,
      roundsWon: n(row.roundsWon),
      parWins,
      roundsPlayed: n(row.roundsPlayed),
      vsPar: parWins > 0 ? n(row.roundsWon) / parWins : 0,
    };
  });
}

export async function upsertUser(db: DB, input: UpsertUserInput): Promise<void> {
  await db
    .insert(users)
    .values({ id: input.id, displayName: input.displayName, avatarUrl: input.avatarUrl ?? null })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? null,
        updatedAt: sql`now()`,
      },
    });
}
