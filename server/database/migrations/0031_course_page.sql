ALTER TABLE "courses" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "intro_video_url" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "audience" jsonb DEFAULT '[]'::jsonb NOT NULL;