CREATE TABLE "centre_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"phone" text NOT NULL,
	"telegram" text,
	"students" integer,
	"message" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"centre_id" uuid,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "telegram" text;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "centre_requests" ADD CONSTRAINT "centre_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "centre_requests" ADD CONSTRAINT "centre_requests_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "centre_requests" ADD CONSTRAINT "centre_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "centre_requests_status_idx" ON "centre_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "centre_requests_user_idx" ON "centre_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attempts_submitted_idx" ON "attempts" USING btree ("submitted_at");