CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"drip_mode" text,
	"available_from" timestamp with time zone,
	"available_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"earned_points" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"duration_seconds" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"type" text NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"context" text,
	"audio_ref" text,
	"image_ref" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"accepted_answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"explanation" text,
	"points" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"exercise_type" text DEFAULT 'PRACTICE' NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"time_limit_seconds" integer,
	"max_attempts" integer,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"show_feedback" text DEFAULT 'AFTER_SUBMIT' NOT NULL,
	"required_for_completion" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "module_id" uuid;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "available_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "available_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "drip_mode" text DEFAULT 'ALWAYS_OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "drip_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "drip_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "passing_score" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_id_lesson_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."lesson_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_questions" ADD CONSTRAINT "exercise_questions_exercise_id_lesson_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."lesson_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_exercises" ADD CONSTRAINT "lesson_exercises_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_modules_course_idx" ON "course_modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "exercise_attempts_user_idx" ON "exercise_attempts" USING btree ("user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "exercise_attempts_exercise_idx" ON "exercise_attempts" USING btree ("exercise_id","user_id");--> statement-breakpoint
CREATE INDEX "exercise_questions_exercise_idx" ON "exercise_questions" USING btree ("exercise_id","position");--> statement-breakpoint
CREATE INDEX "lesson_exercises_lesson_idx" ON "lesson_exercises" USING btree ("lesson_id","position");--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_lessons_module_idx" ON "course_lessons" USING btree ("module_id","position");