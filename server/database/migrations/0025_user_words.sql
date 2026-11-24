CREATE TABLE "user_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word" text NOT NULL,
	"term" text NOT NULL,
	"lemma" text,
	"sentence" text,
	"part_id" uuid,
	"part_of_speech" text,
	"definition" text,
	"translation" text,
	"cefr" text,
	"box" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "word_cache" (
	"term" text NOT NULL,
	"locale" text NOT NULL,
	"lemma" text NOT NULL,
	"part_of_speech" text,
	"definition" text NOT NULL,
	"translation" text,
	"cefr" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "word_cache_term_locale_pk" PRIMARY KEY("term","locale")
);
--> statement-breakpoint
ALTER TABLE "user_words" ADD CONSTRAINT "user_words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_words" ADD CONSTRAINT "user_words_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_words_user_term_uq" ON "user_words" USING btree ("user_id","term");--> statement-breakpoint
CREATE INDEX "user_words_due_idx" ON "user_words" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "user_words_created_idx" ON "user_words" USING btree ("user_id","created_at");