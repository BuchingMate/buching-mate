CREATE TYPE "public"."events_review_status" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_date" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_time" time;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reviewer_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "review_status" "events_review_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "events" SET
  "end_date" = to_char(("date"::timestamp + "time"::time) + ("duration" || ' minutes')::interval, 'YYYY-MM-DD'),
  "end_time" = (("date"::timestamp + "time"::time) + ("duration" || ' minutes')::interval)::time
WHERE "end_date" IS NULL;