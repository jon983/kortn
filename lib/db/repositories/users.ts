import { sql } from 'drizzle-orm';
import type { DB } from '../client';
import { users } from '../schema';

export interface UpsertUserInput {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
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
