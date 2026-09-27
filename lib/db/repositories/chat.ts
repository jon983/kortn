import { asc, eq } from 'drizzle-orm';
import type { DB } from '../client';
import { chatMessages } from '../schema';

export type ChatMessage = typeof chatMessages.$inferSelect;

export interface AddChatMessageInput {
  matchId: string;
  userId: string;
  seatIndex: number;
  body: string;
}

export async function addChatMessage(db: DB, input: AddChatMessageInput): Promise<ChatMessage> {
  const [row] = await db.insert(chatMessages).values(input).returning();
  return row;
}

/** Recent messages for a match, oldest-first, capped to the last `limit`. */
export async function listRecentChatMessages(db: DB, matchId: string, limit = 50): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.matchId, matchId))
    .orderBy(asc(chatMessages.createdAt));
  return rows.slice(-limit);
}
