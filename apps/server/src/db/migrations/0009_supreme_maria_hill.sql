CREATE TYPE "public"."event_registrant_status" AS ENUM('registered', 'cancelled', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."reminder_kind" AS ENUM('t24h', 't1h');--> statement-breakpoint
CREATE TYPE "public"."video_connection_status" AS ENUM('active', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('zoom');--> statement-breakpoint
CREATE TYPE "public"."zoom_account_type" AS ENUM('basic', 'licensed', 'on_prem');--> statement-breakpoint
CREATE TABLE "event_registrants" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"registration_id" text NOT NULL,
	"provider" "video_provider" NOT NULL,
	"external_registrant_id" text,
	"join_url_encrypted" "bytea",
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"status" "event_registrant_status" DEFAULT 'registered' NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"join_time" timestamp,
	"leave_time" timestamp,
	"duration_seconds" integer,
	"ip_address" text,
	"country" text,
	"city" text,
	"device" text,
	"network_type" text,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_video" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"provider" "video_provider" NOT NULL,
	"connection_id" text NOT NULL,
	"external_meeting_id" text NOT NULL,
	"external_meeting_uuid" text,
	"join_url" text NOT NULL,
	"host_start_url_encrypted" "bytea",
	"passcode_encrypted" "bytea",
	"registration_enabled" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"registration_id" text NOT NULL,
	"kind" "reminder_kind" NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"provider" "video_provider" NOT NULL,
	"account_id" text NOT NULL,
	"status" "video_connection_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zoom_video_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"zoom_user_id" text NOT NULL,
	"zoom_account_id" text NOT NULL,
	"email" text,
	"account_type" "zoom_account_type" DEFAULT 'basic' NOT NULL,
	"access_token_encrypted" "bytea" NOT NULL,
	"refresh_token_encrypted" "bytea" NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_registrants" ADD CONSTRAINT "event_registrants_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD CONSTRAINT "event_registrants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrants" ADD CONSTRAINT "event_registrants_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_video" ADD CONSTRAINT "event_video_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_video" ADD CONSTRAINT "event_video_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_video" ADD CONSTRAINT "event_video_connection_id_video_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."video_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_reminders" ADD CONSTRAINT "registration_reminders_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_connections" ADD CONSTRAINT "video_connections_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoom_video_accounts" ADD CONSTRAINT "zoom_video_accounts_connection_id_video_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."video_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrants_event_registration_idx" ON "event_registrants" USING btree ("event_id","registration_id");--> statement-breakpoint
CREATE INDEX "event_registrants_event_idx" ON "event_registrants" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_registrants_org_idx" ON "event_registrants" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "event_registrants_email_idx" ON "event_registrants" USING btree ("event_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "event_video_event_idx" ON "event_video" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_video_org_idx" ON "event_video" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "event_video_connection_idx" ON "event_video" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "event_video_uuid_idx" ON "event_video" USING btree ("external_meeting_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_reminders_reg_kind_idx" ON "registration_reminders" USING btree ("registration_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "video_connections_org_provider_idx" ON "video_connections" USING btree ("org_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "zoom_video_accounts_connection_idx" ON "zoom_video_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zoom_video_accounts_user_idx" ON "zoom_video_accounts" USING btree ("zoom_user_id");