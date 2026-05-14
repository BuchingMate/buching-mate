CREATE TABLE "attendee_payment_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"attendee_id" text NOT NULL,
	"org_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "attendee_payment_profiles" ADD CONSTRAINT "attendee_payment_profiles_attendee_id_attendees_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendee_payment_profiles" ADD CONSTRAINT "attendee_payment_profiles_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendee_payment_profiles_attendee_provider_idx" ON "attendee_payment_profiles" USING btree ("attendee_id","provider");--> statement-breakpoint
CREATE INDEX "attendee_payment_profiles_lookup_idx" ON "attendee_payment_profiles" USING btree ("org_id","provider","provider_customer_id");--> statement-breakpoint
CREATE INDEX "registrations_payment_intent_idx" ON "registrations" USING btree ("payment_intent_id");