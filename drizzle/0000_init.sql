CREATE TYPE "public"."go_out_type" AS ENUM('normal', 'kalooki', 'treasure');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('lobby', 'active', 'finished', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."seat_status" AS ENUM('active', 'busted', 'left');--> statement-breakpoint
CREATE TABLE "game_states" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"seat_index" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"bits_paid" integer DEFAULT 0 NOT NULL,
	"rebought" boolean DEFAULT false NOT NULL,
	"status" "seat_status" DEFAULT 'active' NOT NULL,
	"final_placing" integer,
	CONSTRAINT "match_players_match_id_seat_index_pk" PRIMARY KEY("match_id","seat_index")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "match_status" DEFAULT 'lobby' NOT NULL,
	"created_by" text NOT NULL,
	"seats" integer NOT NULL,
	"pot" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"join_code" text NOT NULL,
	"winner_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "matches_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"seat_index" integer NOT NULL,
	"sequence" integer NOT NULL,
	"action" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"dealer_seat" integer NOT NULL,
	"winner_seat" integer,
	"go_out_type" "go_out_type",
	"scores" jsonb,
	"finished_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"games_played" integer DEFAULT 0 NOT NULL,
	"rounds_won" integer DEFAULT 0 NOT NULL,
	"bits_net" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moves" ADD CONSTRAINT "moves_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_match_user_uq" ON "match_players" USING btree ("match_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moves_match_sequence_uq" ON "moves" USING btree ("match_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_match_number_uq" ON "rounds" USING btree ("match_id","round_number");