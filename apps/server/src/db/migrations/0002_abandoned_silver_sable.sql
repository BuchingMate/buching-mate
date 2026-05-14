CREATE TYPE "public"."public_asset_kind" AS ENUM('org_logo', 'event_image');--> statement-breakpoint
CREATE TYPE "public"."public_asset_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TABLE "public_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text,
	"kind" "public_asset_kind" NOT NULL,
	"key" text NOT NULL,
	"public_url" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"status" "public_asset_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "public_assets" ADD CONSTRAINT "public_assets_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_assets" ADD CONSTRAINT "public_assets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_assets_org_id_idx" ON "public_assets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "public_assets_event_id_idx" ON "public_assets" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "public_assets_key_idx" ON "public_assets" USING btree ("key");