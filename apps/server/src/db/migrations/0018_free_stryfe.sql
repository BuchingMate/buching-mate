CREATE TABLE "email_event" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"resend_email_id" text NOT NULL,
	"event_type" text NOT NULL,
	"kind" text,
	"to_email" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_settings" ADD COLUMN "sending_suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_event_unique_idx" ON "email_event" USING btree ("resend_email_id","event_type");--> statement-breakpoint
CREATE INDEX "email_event_org_received_idx" ON "email_event" USING btree ("org_id","received_at");