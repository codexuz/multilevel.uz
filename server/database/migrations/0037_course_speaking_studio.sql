CREATE TABLE "course_speaking_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"overall" integer NOT NULL,
	"fluency" integer,
	"vocabulary" integer,
	"grammar" integer,
	"pronunciation" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_speaking_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_speaking_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"tips" text,
	"part_label" text,
	"suggested_seconds" integer,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_speaking_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"audio_url" text NOT NULL,
	"duration_seconds" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_speaking_assessments" ADD CONSTRAINT "course_speaking_assessments_recording_id_course_speaking_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."course_speaking_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_assessments" ADD CONSTRAINT "course_speaking_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_comments" ADD CONSTRAINT "course_speaking_comments_recording_id_course_speaking_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."course_speaking_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_comments" ADD CONSTRAINT "course_speaking_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_questions" ADD CONSTRAINT "course_speaking_questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_questions" ADD CONSTRAINT "course_speaking_questions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_recordings" ADD CONSTRAINT "course_speaking_recordings_question_id_course_speaking_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."course_speaking_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_recordings" ADD CONSTRAINT "course_speaking_recordings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_speaking_recordings" ADD CONSTRAINT "course_speaking_recordings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_speaking_assess_rec_user_uq" ON "course_speaking_assessments" USING btree ("recording_id","user_id");--> statement-breakpoint
CREATE INDEX "course_speaking_assess_rec_idx" ON "course_speaking_assessments" USING btree ("recording_id");--> statement-breakpoint
CREATE INDEX "course_speaking_comments_rec_idx" ON "course_speaking_comments" USING btree ("recording_id","created_at");--> statement-breakpoint
CREATE INDEX "course_speaking_questions_course_idx" ON "course_speaking_questions" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "course_speaking_rec_question_idx" ON "course_speaking_recordings" USING btree ("question_id","created_at");--> statement-breakpoint
CREATE INDEX "course_speaking_rec_course_idx" ON "course_speaking_recordings" USING btree ("course_id","created_at");--> statement-breakpoint
CREATE INDEX "course_speaking_rec_user_idx" ON "course_speaking_recordings" USING btree ("user_id","created_at");