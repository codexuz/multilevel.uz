-- Learning centres are removed: their data goes with them (classes, members, assignments, mock sessions,
-- mock credits and the walk-in accounts made for their sessions). Teachers own classes from now on.
DELETE FROM "users" WHERE "mock_only" AND "id" IN (
  SELECT c."user_id" FROM "mock_candidates" c JOIN "mock_sessions" s ON s."id" = c."session_id"
  WHERE s."centre_id" IS NOT NULL AND c."external"
);--> statement-breakpoint
DELETE FROM "mock_sessions" WHERE "centre_id" IS NOT NULL;--> statement-breakpoint
DELETE FROM "mock_credit_transactions" WHERE "centre_id" IS NOT NULL OR "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "class_groups";--> statement-breakpoint
UPDATE "users" SET "role" = 'teacher' WHERE "role" = 'center_owner';--> statement-breakpoint
ALTER TABLE "class_groups" DROP CONSTRAINT "class_groups_centre_id_centres_id_fk";
--> statement-breakpoint
ALTER TABLE "class_groups" DROP CONSTRAINT "class_groups_teacher_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "mock_credit_transactions" DROP CONSTRAINT "mock_credit_transactions_centre_id_centres_id_fk";
--> statement-breakpoint
ALTER TABLE "mock_sessions" DROP CONSTRAINT "mock_sessions_centre_id_centres_id_fk";
--> statement-breakpoint
DROP INDEX "class_groups_centre_idx";--> statement-breakpoint
DROP INDEX "mock_credit_centre_idx";--> statement-breakpoint
DROP INDEX "mock_sessions_centre_idx";--> statement-breakpoint
ALTER TABLE "class_groups" ALTER COLUMN "teacher_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_credit_transactions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_groups_teacher_idx" ON "class_groups" USING btree ("teacher_id");--> statement-breakpoint
ALTER TABLE "class_groups" DROP COLUMN "centre_id";--> statement-breakpoint
ALTER TABLE "mock_credit_transactions" DROP COLUMN "centre_id";--> statement-breakpoint
ALTER TABLE "mock_sessions" DROP COLUMN "centre_id";--> statement-breakpoint
DROP TABLE "centre_members";--> statement-breakpoint
DROP TABLE "centre_requests";--> statement-breakpoint
DROP TABLE "centres";
