CREATE TYPE "public"."polar_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TABLE "polar_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"polar_customer_id" text NOT NULL,
	"polar_subscription_id" text,
	"polar_product_id" text,
	"status" "polar_subscription_status" DEFAULT 'incomplete' NOT NULL,
	"seat_count" integer DEFAULT 1 NOT NULL,
	"current_period_end" timestamp,
	"trial_ends_at" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "polar_subscriptions" ADD CONSTRAINT "polar_subscriptions_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "polar_subscriptions_org_idx" ON "polar_subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "polar_subscriptions_subscription_idx" ON "polar_subscriptions" USING btree ("polar_subscription_id");