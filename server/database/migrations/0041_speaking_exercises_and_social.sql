ALTER TABLE "course_speaking_questions" ADD COLUMN IF NOT EXISTS "exercise_id" uuid;
--> statement-breakpoint
ALTER TABLE "course_speaking_questions" ADD COLUMN IF NOT EXISTS "lesson_id" uuid;
--> statement-breakpoint
ALTER TABLE "course_speaking_recordings" ADD COLUMN IF NOT EXISTS "ai_review" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_speaking_likes" (
	"recording_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_speaking_likes_recording_id_user_id_pk" PRIMARY KEY("recording_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_speaking_questions" ADD CONSTRAINT "course_speaking_questions_exercise_id_lesson_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."lesson_exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_speaking_questions" ADD CONSTRAINT "course_speaking_questions_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_speaking_likes" ADD CONSTRAINT "course_speaking_likes_recording_id_course_speaking_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."course_speaking_recordings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_speaking_likes" ADD CONSTRAINT "course_speaking_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_speaking_questions_exercise_idx" ON "course_speaking_questions" USING btree ("exercise_id","position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_speaking_questions_lesson_idx" ON "course_speaking_questions" USING btree ("lesson_id","position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_speaking_likes_rec_idx" ON "course_speaking_likes" USING btree ("recording_id");
