CREATE TYPE "public"."calendar_subscription_status" AS ENUM('subscribed', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "calendar_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"attendee_id" text,
	"status" "calendar_subscription_status" DEFAULT 'subscribed' NOT NULL,
	"source" text DEFAULT 'registration' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_attendee_id_attendees_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_subscriptions_org_email_idx" ON "calendar_subscriptions" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "calendar_subscriptions_org_status_idx" ON "calendar_subscriptions" USING btree ("org_id","status");