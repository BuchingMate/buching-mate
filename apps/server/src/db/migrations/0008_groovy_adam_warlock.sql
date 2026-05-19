CREATE TABLE "subscription_usage" (
	"org_id" text NOT NULL,
	"metric" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_usage_pk_idx" ON "subscription_usage" USING btree ("org_id","metric","period_start");