CREATE TYPE "public"."custom_domain_status" AS ENUM('pending', 'verifying', 'active', 'failed', 'disabled');--> statement-breakpoint
CREATE TABLE "org_custom_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"hostname" text NOT NULL,
	"cloudflare_hostname_id" text,
	"status" "custom_domain_status" DEFAULT 'pending' NOT NULL,
	"dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_checked_at" timestamp,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_custom_domains" ADD CONSTRAINT "org_custom_domains_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_custom_domains_org_idx" ON "org_custom_domains" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_custom_domains_hostname_idx" ON "org_custom_domains" USING btree ("hostname");