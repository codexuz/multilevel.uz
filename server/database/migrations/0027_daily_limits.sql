-- Marking credits are gone: Writing and Speaking that waited for one (AWAITING_CREDIT) are SAVED now,
-- marked by the AI check, and sent to a teacher once the student is in a class.
UPDATE "attempts" SET "status" = 'SAVED' WHERE "status" = 'AWAITING_CREDIT';--> statement-breakpoint
CREATE TABLE "explanation_opens" (
	"user_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"opened_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explanation_opens_user_id_attempt_id_pk" PRIMARY KEY("user_id","attempt_id")
);
--> statement-breakpoint
ALTER TABLE "explanation_opens" ADD CONSTRAINT "explanation_opens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_opens" ADD CONSTRAINT "explanation_opens_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "explanation_opens_day_idx" ON "explanation_opens" USING btree ("user_id","opened_on");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "marker";