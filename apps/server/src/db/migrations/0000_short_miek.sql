CREATE SCHEMA "auth";
--> statement-breakpoint
REVOKE ALL ON SCHEMA "auth" FROM PUBLIC;
--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('upcoming', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('published', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_required', 'pending', 'paid', 'refunded', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending', 'confirmed', 'waitlisted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('instructor', 'material', 'location', 'equipment', 'custom');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivered', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TABLE "attendees" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"role" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"created_by_id" text,
	"title" text NOT NULL,
	"description" text,
	"notes" text,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"date" text NOT NULL,
	"time" time NOT NULL,
	"duration" integer NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"max_capacity" integer,
	"location" text,
	"status" "event_status" DEFAULT 'upcoming' NOT NULL,
	"visibility" "event_visibility" DEFAULT 'unpublished' NOT NULL,
	"archived_at" timestamp,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurrence_frequency" text,
	"recurrence_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recurrence_interval" integer,
	"recurrence_end_date" text,
	"price" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"plan" "org_plan" DEFAULT 'free' NOT NULL,
	"contact_email" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_configs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_url" text,
	"webhook_secret" text,
	"email_templates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_id" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"registration_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_refund_id" text,
	"payment_reference" text NOT NULL,
	"requested_amount" bigint NOT NULL,
	"settled_amount" bigint,
	"currency" text NOT NULL,
	"reason" text,
	"status" text NOT NULL,
	"failure_reason" text,
	"raw_request" jsonb,
	"raw_response" jsonb,
	"requested_by_user_id" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paypal_payment_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"tracking_id" text NOT NULL,
	"granted_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payments_receivable" boolean DEFAULT false NOT NULL,
	"primary_email_confirmed" boolean DEFAULT false NOT NULL,
	"oauth_integrations" jsonb,
	"onboarding_status" text NOT NULL,
	"environment" text NOT NULL,
	"last_status_check_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_id" text NOT NULL,
	"attendee_id" text NOT NULL,
	"status" "registration_status" DEFAULT 'confirmed' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'not_required' NOT NULL,
	"checkout_session_id" text,
	"payment_provider" text,
	"payment_expires_at" timestamp,
	"payment_idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"type" "resource_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"email" text,
	"phone" text,
	"capacity" integer,
	"url" text,
	"cost" numeric(12, 2),
	"currency" text,
	"notes" text,
	"archived_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "square_payment_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"location_id" text NOT NULL,
	"access_token_encrypted" "bytea" NOT NULL,
	"refresh_token_encrypted" "bytea" NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"short_lived" boolean DEFAULT false NOT NULL,
	"environment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_payment_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"stripe_user_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"scope" text,
	"default_currency" text,
	"country" text,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"email" text,
	"raw_account" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_attempt_at" timestamp,
	"last_error" text,
	"response_status" integer,
	"duration_ms" integer,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_resources" ADD CONSTRAINT "event_resources_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_resources" ADD CONSTRAINT "event_resources_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_resources" ADD CONSTRAINT "event_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_connections" ADD CONSTRAINT "payment_connections_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_payment_accounts" ADD CONSTRAINT "paypal_payment_accounts_connection_id_payment_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."payment_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_attendee_id_attendees_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "square_payment_accounts" ADD CONSTRAINT "square_payment_accounts_connection_id_payment_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."payment_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payment_accounts" ADD CONSTRAINT "stripe_payment_accounts_connection_id_payment_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."payment_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendees_org_id_idx" ON "attendees" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendees_org_email_idx" ON "attendees" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "event_resources_org_id_idx" ON "event_resources" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "event_resources_event_id_idx" ON "event_resources" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_resources_event_resource_role_idx" ON "event_resources" USING btree ("event_id","resource_id","role");--> statement-breakpoint
CREATE INDEX "events_org_id_idx" ON "events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "events_org_date_idx" ON "events" USING btree ("org_id","date");--> statement-breakpoint
CREATE INDEX "events_org_status_idx" ON "events" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "events_org_visibility_idx" ON "events" USING btree ("org_id","visibility");--> statement-breakpoint
CREATE INDEX "events_org_archived_at_idx" ON "events" USING btree ("org_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_settings_org_id_idx" ON "org_settings" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_connections_org_provider_idx" ON "payment_connections" USING btree ("org_id","provider");--> statement-breakpoint
CREATE INDEX "payment_refunds_registration_idx" ON "payment_refunds" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_reference_idx" ON "payment_refunds" USING btree ("payment_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_payment_accounts_connection_idx" ON "paypal_payment_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_payment_accounts_tracking_idx" ON "paypal_payment_accounts" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "registrations_org_id_idx" ON "registrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "registrations_event_id_idx" ON "registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "registrations_attendee_id_idx" ON "registrations" USING btree ("attendee_id");--> statement-breakpoint
CREATE INDEX "registrations_payment_expires_idx" ON "registrations" USING btree ("payment_expires_at");--> statement-breakpoint
CREATE INDEX "resources_org_id_idx" ON "resources" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "resources_org_type_idx" ON "resources" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "resources_org_archived_at_idx" ON "resources" USING btree ("org_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "square_payment_accounts_connection_idx" ON "square_payment_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_payment_accounts_connection_idx" ON "stripe_payment_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_payment_accounts_user_idx" ON "stripe_payment_accounts" USING btree ("stripe_user_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_org_id_idx" ON "webhook_deliveries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_org_status_idx" ON "webhook_deliveries" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_idx" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events" USING btree ("provider");
