import { sql } from 'drizzle-orm';
import type { DB } from '../client';
import { rounds } from '../schema';

export interface RecordRoundInput {
  matchId: string;
  roundNumber: number;
  dealerSeat: number;
  winnerSeat: number;
  goOutType: 'normal' | 'kalooki' | 'treasure';
  scores: number[];
}

export async function recordRound(db: DB, input: RecordRoundInput): Promise<void> {
  await db.insert(rounds).values({
    matchId: input.matchId,
    roundNumber: input.roundNumber,
    dealerSeat: input.dealerSeat,
    winnerSeat: input.winnerSeat,
    goOutType: input.goOutType,
    scores: input.scores,
    finishedAt: sql`now()`,
  });
}
