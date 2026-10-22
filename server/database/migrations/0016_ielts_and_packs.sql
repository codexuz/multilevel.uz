CREATE TABLE "pack_tests" (
	"pack_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pack_tests_pack_id_test_id_pk" PRIMARY KEY("pack_id","test_id")
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"exam" text DEFAULT 'IELTS' NOT NULL,
	"price_uzs" integer NOT NULL,
	"old_price_uzs" integer,
	"cover_url" text,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD COLUMN "band" real;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "exam" text DEFAULT 'MULTILEVEL' NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "band" real;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pack_id" uuid;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "exam" text DEFAULT 'MULTILEVEL' NOT NULL;--> statement-breakpoint
ALTER TABLE "speaking_parts" ADD COLUMN "exam" text DEFAULT 'MULTILEVEL' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "exam" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "target_band" real;--> statement-breakpoint
ALTER TABLE "writing_tasks" ADD COLUMN "exam" text DEFAULT 'MULTILEVEL' NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_tests" ADD CONSTRAINT "pack_tests_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_tests" ADD CONSTRAINT "pack_tests_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pack_tests_test_idx" ON "pack_tests" USING btree ("test_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;