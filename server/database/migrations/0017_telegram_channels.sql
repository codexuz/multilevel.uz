CREATE TABLE "telegram_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"exam" text,
	"locale" text DEFAULT 'uz' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_channels_chat_unique" UNIQUE("chat")
);
--> statement-breakpoint
ALTER TABLE "live_mocks" ADD COLUMN "channel_ids" text[];