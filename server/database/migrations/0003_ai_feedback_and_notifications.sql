CREATE TABLE "ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"attempt_id" uuid,
	"test_id" uuid,
	"skill" text DEFAULT 'WRITING' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb,
	"score" integer,
	"cefr_level" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_reviews_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_notify" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_reviews_user_idx" ON "ai_reviews" USING btree ("user_id","created_at");