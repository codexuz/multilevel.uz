ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'PUBLIC' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "teacher_id" uuid;
--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "teacher_id" uuid;
--> statement-breakpoint
ALTER TABLE "writing_tasks" ADD COLUMN IF NOT EXISTS "teacher_id" uuid;
--> statement-breakpoint
ALTER TABLE "speaking_parts" ADD COLUMN IF NOT EXISTS "teacher_id" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_groups" (
	"test_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_groups_test_id_group_id_pk" PRIMARY KEY("test_id","group_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "test_students" (
	"test_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_students_test_id_user_id_pk" PRIMARY KEY("test_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tests" ADD CONSTRAINT "tests_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parts" ADD CONSTRAINT "parts_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "writing_tasks" ADD CONSTRAINT "writing_tasks_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "speaking_parts" ADD CONSTRAINT "speaking_parts_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_groups" ADD CONSTRAINT "test_groups_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_groups" ADD CONSTRAINT "test_groups_group_id_class_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_students" ADD CONSTRAINT "test_students_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "test_students" ADD CONSTRAINT "test_students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tests_teacher_idx" ON "tests" USING btree ("teacher_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tests_visibility_status_idx" ON "tests" USING btree ("visibility","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parts_teacher_idx" ON "parts" USING btree ("teacher_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "writing_tasks_teacher_idx" ON "writing_tasks" USING btree ("teacher_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "speaking_parts_teacher_idx" ON "speaking_parts" USING btree ("teacher_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_groups_group_idx" ON "test_groups" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_students_user_idx" ON "test_students" USING btree ("user_id");
