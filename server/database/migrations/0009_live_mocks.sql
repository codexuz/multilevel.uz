CREATE TABLE "live_mocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"announced_at" timestamp with time zone,
	"results_sent_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "live_mock_id" uuid;--> statement-breakpoint
ALTER TABLE "live_mocks" ADD CONSTRAINT "live_mocks_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_mocks" ADD CONSTRAINT "live_mocks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_mocks_window_idx" ON "live_mocks" USING btree ("starts_at","ends_at");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_live_mock_id_live_mocks_id_fk" FOREIGN KEY ("live_mock_id") REFERENCES "public"."live_mocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_live_mock_uq" ON "attempts" USING btree ("live_mock_id","user_id","skill") WHERE "attempts"."live_mock_id" is not null;