CREATE TABLE "auth"."attendee_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "attendee_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."attendee_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "attendee_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."attendee_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "attendee_user_id" text;--> statement-breakpoint
ALTER TABLE "auth"."attendee_session" ADD CONSTRAINT "attendee_session_user_id_attendee_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."attendee_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_attendee_user_id_attendee_user_id_fk" FOREIGN KEY ("attendee_user_id") REFERENCES "auth"."attendee_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendees_user_id_idx" ON "attendees" USING btree ("attendee_user_id");