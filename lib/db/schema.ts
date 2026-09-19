// lib/db/schema.ts
import {
  pgTable, pgEnum, text, integer, boolean, timestamp, uuid, jsonb, primaryKey, uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { MatchState, Action } from '../kalooki';

export type MatchSettings = { note?: string };

export const matchStatusEnum = pgEnum('match_status', ['lobby', 'active', 'finished', 'abandoned']);
export const seatStatusEnum = pgEnum('seat_status', ['active', 'busted', 'left']);
export const goOutTypeEnum = pgEnum('go_out_type', ['normal', 'kalooki', 'treasure']);

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user id
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  gamesPlayed: integer('games_played').notNull().default(0),
  roundsWon: integer('rounds_won').notNull().default(0),
  bitsNet: integer('bits_net').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: matchStatusEnum('status').notNull().default('lobby'),
  createdBy: text('created_by').notNull().references(() => users.id),
  seats: integer('seats').notNull(),
  pot: integer('pot').notNull().default(0),
  settings: jsonb('settings').$type<MatchSettings>().notNull().default({}),
  joinCode: text('join_code').notNull().unique(),
  winnerUserId: text('winner_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const matchPlayers = pgTable('match_players', {
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  seatIndex: integer('seat_index').notNull(),
  score: integer('score').notNull().default(0),
  bitsPaid: integer('bits_paid').notNull().default(0),
  rebought: boolean('rebought').notNull().default(false),
  status: seatStatusEnum('status').notNull().default('active'),
  finalPlacing: integer('final_placing'),
}, (t) => ({
  pk: primaryKey({ columns: [t.matchId, t.seatIndex] }),
}));

export const rounds = pgTable('rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  dealerSeat: integer('dealer_seat').notNull(),
  winnerSeat: integer('winner_seat'),
  goOutType: goOutTypeEnum('go_out_type'),
  scores: jsonb('scores').$type<number[]>(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uqRound: uniqueIndex('rounds_match_number_uq').on(t.matchId, t.roundNumber),
}));

export const gameStates = pgTable('game_states', {
  matchId: uuid('match_id').primaryKey().references(() => matches.id, { onDelete: 'cascade' }),
  state: jsonb('state').$type<MatchState>().notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moves = pgTable('moves', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  roundNumber: integer('round_number').notNull(),
  seatIndex: integer('seat_index').notNull(),
  sequence: integer('sequence').notNull(),
  action: jsonb('action').$type<Action>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqSeq: uniqueIndex('moves_match_sequence_uq').on(t.matchId, t.sequence),
}));
