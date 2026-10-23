ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student'::text;--> statement-breakpoint
-- Examiners are gone: they become teachers (marking is the admins' now).
UPDATE "users" SET "role" = 'teacher' WHERE "role" = 'examiner';--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'teacher', 'center_owner', 'admin');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
-- Who owns or teaches at a centre gets that role (admins stay admins).
UPDATE "users" SET "role" = 'center_owner' WHERE "role" IN ('student', 'teacher') AND "id" IN (SELECT "user_id" FROM "centre_members" WHERE "role" = 'OWNER');--> statement-breakpoint
UPDATE "users" SET "role" = 'teacher' WHERE "role" = 'student' AND "id" IN (SELECT "user_id" FROM "centre_members" WHERE "role" = 'TEACHER');
