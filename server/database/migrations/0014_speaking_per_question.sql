DROP INDEX "speaking_responses_attempt_part_uq";--> statement-breakpoint
ALTER TABLE "speaking_responses" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "speaking_responses_attempt_part_position_uq" ON "speaking_responses" USING btree ("attempt_id","part_id","position");