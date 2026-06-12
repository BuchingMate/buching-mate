CREATE TABLE "email_suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'unsubscribe' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_settings" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_suppressions_org_email_idx" ON "email_suppressions" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "email_suppressions_org_idx" ON "email_suppressions" USING btree ("org_id");