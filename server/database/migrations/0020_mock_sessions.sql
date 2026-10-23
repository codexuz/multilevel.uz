CREATE TABLE "mock_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"external" boolean DEFAULT false NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"document_no" text,
	"paid_uzs" integer,
	"payment_method" text,
	"paid_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"seat_code" text,
	"seated_at" timestamp with time zone,
	"seat_session_id" uuid,
	"unlocked_skills" text[] DEFAULT '{}' NOT NULL,
	"live" jsonb,
	"marks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"released_at" timestamp with time zone,
	"report_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mock_candidates_report_token_unique" UNIQUE("report_token")
);
--> statement-breakpoint
CREATE TABLE "mock_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centre_id" uuid,
	"user_id" uuid,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"candidate_id" uuid,
	"note" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centre_id" uuid,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"test_id" uuid NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"room" text,
	"capacity" integer,
	"price_uzs" integer,
	"hold_results" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "mock_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mock_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_candidates" ADD CONSTRAINT "mock_candidates_session_id_mock_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mock_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_candidates" ADD CONSTRAINT "mock_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_credit_transactions" ADD CONSTRAINT "mock_credit_transactions_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_credit_transactions" ADD CONSTRAINT "mock_credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_credit_transactions" ADD CONSTRAINT "mock_credit_transactions_candidate_id_mock_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."mock_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_credit_transactions" ADD CONSTRAINT "mock_credit_transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD CONSTRAINT "mock_sessions_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD CONSTRAINT "mock_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD CONSTRAINT "mock_sessions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mock_candidates_session_user_uq" ON "mock_candidates" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "mock_candidates_code_idx" ON "mock_candidates" USING btree ("seat_code");--> statement-breakpoint
CREATE INDEX "mock_credit_centre_idx" ON "mock_credit_transactions" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "mock_credit_user_idx" ON "mock_credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mock_sessions_centre_idx" ON "mock_sessions" USING btree ("centre_id","opens_at");--> statement-breakpoint
CREATE INDEX "mock_sessions_owner_idx" ON "mock_sessions" USING btree ("owner_id","opens_at");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_mock_candidate_id_mock_candidates_id_fk" FOREIGN KEY ("mock_candidate_id") REFERENCES "public"."mock_candidates"("id") ON DELETE set null ON UPDATE no action;