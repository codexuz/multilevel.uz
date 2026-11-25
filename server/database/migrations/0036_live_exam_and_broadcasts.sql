CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"texts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_url" text,
	"button_text" text,
	"button_url" text,
	"audience" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"channel_ids" text[],
	"status" text DEFAULT 'SENDING' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "live_mocks" ADD COLUMN "exam" text DEFAULT 'MULTILEVEL' NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcasts_created_idx" ON "broadcasts" USING btree ("created_at");--> statement-breakpoint
UPDATE "live_mocks" SET "exam" = 'IELTS' FROM "tests" WHERE "tests"."id" = "live_mocks"."test_id" AND "tests"."module" IN ('ACADEMIC', 'GENERAL_TRAINING');
