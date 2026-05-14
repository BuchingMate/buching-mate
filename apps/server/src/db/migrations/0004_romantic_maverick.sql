ALTER TABLE "public"."org_settings" ALTER COLUMN "plan" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."org_settings" ALTER COLUMN "plan" SET DATA TYPE text;--> statement-breakpoint
UPDATE "public"."org_settings" SET "plan" = 'team' WHERE "plan" = 'pro';--> statement-breakpoint
DROP TYPE "public"."org_plan";--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('free', 'team', 'enterprise');--> statement-breakpoint
ALTER TABLE "public"."org_settings" ALTER COLUMN "plan" SET DATA TYPE "public"."org_plan" USING "plan"::"public"."org_plan";--> statement-breakpoint
ALTER TABLE "public"."org_settings" ALTER COLUMN "plan" SET DEFAULT 'free';
