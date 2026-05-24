CREATE TYPE "public"."email_domain_status" AS ENUM('pending', 'verifying', 'active', 'failed');--> statement-breakpoint
CREATE TABLE "org_email_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"domain" text NOT NULL,
	"resend_domain_id" text NOT NULL,
	"status" "email_domain_status" DEFAULT 'pending' NOT NULL,
	"dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_checked_at" timestamp,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_email_domains" ADD CONSTRAINT "org_email_domains_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_email_domains_org_idx" ON "org_email_domains" USING btree ("org_id");