CREATE TABLE "vocab_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"term" text NOT NULL,
	"part_of_speech" text,
	"ipa" text,
	"definition" text NOT NULL,
	"example" text,
	"translation_uz" text,
	"translation_ru" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocab_deck_groups" (
	"deck_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocab_deck_groups_deck_id_group_id_pk" PRIMARY KEY("deck_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "vocab_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"topic" text,
	"level" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocab_progress" (
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"box" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"wrong" integer DEFAULT 0 NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocab_progress_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"amount" integer NOT NULL,
	"ref_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_goal" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "vocab_cards" ADD CONSTRAINT "vocab_cards_deck_id_vocab_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."vocab_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_deck_groups" ADD CONSTRAINT "vocab_deck_groups_deck_id_vocab_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."vocab_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_deck_groups" ADD CONSTRAINT "vocab_deck_groups_group_id_class_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_decks" ADD CONSTRAINT "vocab_decks_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_progress" ADD CONSTRAINT "vocab_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_progress" ADD CONSTRAINT "vocab_progress_card_id_vocab_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."vocab_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vocab_cards_deck_idx" ON "vocab_cards" USING btree ("deck_id","position");--> statement-breakpoint
CREATE INDEX "vocab_deck_groups_group_idx" ON "vocab_deck_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "vocab_decks_teacher_idx" ON "vocab_decks" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "vocab_progress_user_idx" ON "vocab_progress" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_user_ref_uq" ON "xp_events" USING btree ("user_id","ref_key") WHERE ref_key is not null;--> statement-breakpoint
CREATE INDEX "xp_events_user_time_idx" ON "xp_events" USING btree ("user_id","created_at");