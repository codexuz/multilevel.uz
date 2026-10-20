-- The old test system, courses, community, live speaking, gamification and premium go; accounts stay.
--> statement-breakpoint
DROP TABLE IF EXISTS "answers", "attempts", "questions", "parts", "sections", "tests", "speaking_rooms", "transactions", "subscriptions", "lesson_progress", "enrollments", "lessons", "course_modules", "courses", "community_replies", "community_post_likes", "community_posts" CASCADE;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."attempt_status", "public"."question_type", "public"."section_type", "public"."test_status", "public"."room_status", "public"."sub_plan", "public"."sub_status", "public"."currency", "public"."course_status", "public"."lesson_type", "public"."enrollment_status";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "points", DROP COLUMN IF EXISTS "coins", DROP COLUMN IF EXISTS "streak_count", DROP COLUMN IF EXISTS "last_activity_date";
--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"response" text,
	"is_correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"test_id" uuid,
	"section_id" uuid,
	"skill" text NOT NULL,
	"mode" text DEFAULT 'PRACTICE' NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graded_at" timestamp with time zone,
	"correct" integer,
	"total" integer,
	"score" integer,
	"cefr_level" text,
	"examiner_id" uuid,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill" text NOT NULL,
	"part_number" integer NOT NULL,
	"title" text,
	"passage" text,
	"audio_ref" text,
	"transcript_ref" text,
	"difficulty" text,
	"time_limit_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"type" text NOT NULL,
	"instruction" text,
	"context" text,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"prompt" text,
	"accepted_answers" text[] DEFAULT '{}' NOT NULL,
	"explanation" text,
	"evidence" text,
	"points" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"part_id" uuid,
	"writing_task_id" uuid,
	"speaking_part_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"title" text,
	"instructions" text,
	"duration_seconds" integer,
	"audio_ref" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaking_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_number" integer NOT NULL,
	"title" text,
	"cue_card" text,
	"image_ref" text,
	"prep_seconds" integer,
	"speak_seconds" integer,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaking_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"text" text NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaking_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"audio_ref" text NOT NULL,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"mode" text DEFAULT 'PRACTICE' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"category" text,
	"module" text DEFAULT 'MULTILEVEL' NOT NULL,
	"source" text,
	"created_by_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "writing_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_number" integer NOT NULL,
	"module" text,
	"title" text,
	"prompt" text NOT NULL,
	"image_ref" text,
	"min_words" integer,
	"suggested_minutes" integer,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_item_id_question_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."question_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_examiner_id_users_id_fk" FOREIGN KEY ("examiner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_task_id_writing_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."writing_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "question_items" ADD CONSTRAINT "question_items_group_id_question_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."question_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "section_items" ADD CONSTRAINT "section_items_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "section_items" ADD CONSTRAINT "section_items_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "section_items" ADD CONSTRAINT "section_items_writing_task_id_writing_tasks_id_fk" FOREIGN KEY ("writing_task_id") REFERENCES "public"."writing_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "section_items" ADD CONSTRAINT "section_items_speaking_part_id_speaking_parts_id_fk" FOREIGN KEY ("speaking_part_id") REFERENCES "public"."speaking_parts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "speaking_parts" ADD CONSTRAINT "speaking_parts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "speaking_questions" ADD CONSTRAINT "speaking_questions_part_id_speaking_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."speaking_parts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "speaking_responses" ADD CONSTRAINT "speaking_responses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "speaking_responses" ADD CONSTRAINT "speaking_responses_part_id_speaking_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."speaking_parts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "writing_tasks" ADD CONSTRAINT "writing_tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "answers_attempt_item_uq" ON "answers" USING btree ("attempt_id","item_id");
--> statement-breakpoint
CREATE INDEX "attempts_user_idx" ON "attempts" USING btree ("user_id","submitted_at");
--> statement-breakpoint
CREATE INDEX "attempts_status_idx" ON "attempts" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "essays_attempt_task_uq" ON "essays" USING btree ("attempt_id","task_id");
--> statement-breakpoint
CREATE INDEX "question_groups_part_idx" ON "question_groups" USING btree ("part_id","position");
--> statement-breakpoint
CREATE INDEX "question_items_group_idx" ON "question_items" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX "section_items_section_idx" ON "section_items" USING btree ("section_id","position");
--> statement-breakpoint
CREATE UNIQUE INDEX "sections_test_skill_uq" ON "sections" USING btree ("test_id","skill");
--> statement-breakpoint
CREATE INDEX "speaking_questions_part_idx" ON "speaking_questions" USING btree ("part_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "speaking_responses_attempt_part_uq" ON "speaking_responses" USING btree ("attempt_id","part_id");
--> statement-breakpoint
CREATE INDEX "tests_status_idx" ON "tests" USING btree ("status");
