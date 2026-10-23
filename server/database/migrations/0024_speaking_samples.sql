ALTER TABLE "speaking_parts" ADD COLUMN "audio_ref" text;--> statement-breakpoint
ALTER TABLE "speaking_parts" ADD COLUMN "sample_answer" text;--> statement-breakpoint
ALTER TABLE "speaking_questions" ADD COLUMN "audio_ref" text;--> statement-breakpoint
ALTER TABLE "speaking_questions" ADD COLUMN "sample_answer" text;