import { eq, sql } from 'drizzle-orm';
import type { DB } from '../client';
import { users } from '../schema';

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

export async function getUserStats(db: DB, userId: string): Promise<{ gamesPlayed: number; roundsWon: number; bitsNet: number } | null> {
  const [u] = await db.select({
    gamesPlayed: users.gamesPlayed, roundsWon: users.roundsWon, bitsNet: users.bitsNet,
  }).from(users).where(eq(users.id, userId)).limit(1);
  return u ?? null;
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
