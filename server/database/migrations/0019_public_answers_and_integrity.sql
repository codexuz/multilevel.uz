ALTER TABLE "attempts" ADD COLUMN "integrity" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "integrity_flags" text[];--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "integrity_status" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "integrity_note" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "integrity_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "integrity_reviewed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "essays" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_integrity_reviewed_by_id_users_id_fk" FOREIGN KEY ("integrity_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_integrity_idx" ON "attempts" USING btree ("integrity_status","submitted_at");--> statement-breakpoint
CREATE INDEX "essays_shared_idx" ON "essays" USING btree ("task_id","shared_at");