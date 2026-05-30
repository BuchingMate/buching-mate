export * from "./auth-schema";

import {
  bigint,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { attendeeUser, organization, user } from "./auth-schema";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at").notNull().defaultNow();
const updatedAt = () => timestamp("updated_at").notNull().defaultNow();

const byteaCol = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const orgRole = pgEnum("org_role", ["owner", "admin", "manager", "viewer"]);
export const orgPlan = pgEnum("org_plan", ["free", "team", "enterprise"]);
export const polarSubscriptionStatus = pgEnum("polar_subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);
export const eventStatus = pgEnum("event_status", ["upcoming", "completed", "cancelled"]);
export const eventVisibility = pgEnum("event_visibility", ["published", "unpublished"]);
export const eventReviewStatus = pgEnum("events_review_status", [
  "none",
  "pending",
  "approved",
  "rejected",
]);
export const publicAssetKind = pgEnum("public_asset_kind", ["org_logo", "event_image"]);
export const publicAssetStatus = pgEnum("public_asset_status", ["pending", "ready"]);
export const registrationStatus = pgEnum("registration_status", [
  "pending",
  "confirmed",
  "waitlisted",
  "cancelled",
]);
export const paymentStatus = pgEnum("payment_status", [
  "not_required",
  "pending",
  "paid",
  "refunded",
  "expired",
  "failed",
]);
export const resourceType = pgEnum("resource_type", [
  "instructor",
  "material",
  "location",
  "equipment",
  "custom",
]);
export const webhookDeliveryStatus = pgEnum("webhook_delivery_status", [
  "pending",
  "delivered",
  "failed",
  "dead_letter",
]);
export const videoProvider = pgEnum("video_provider", ["zoom"]);
export const videoConnectionStatus = pgEnum("video_connection_status", [
  "active",
  "revoked",
  "error",
]);
export const eventRegistrantStatus = pgEnum("event_registrant_status", [
  "registered",
  "cancelled",
  "attended",
  "no_show",
]);
export const zoomAccountType = pgEnum("zoom_account_type", ["basic", "licensed", "on_prem"]);
export const emailDomainStatus = pgEnum("email_domain_status", [
  "pending",
  "verifying",
  "active",
  "failed",
]);
export const broadcastKind = pgEnum("broadcast_kind", ["newsletter", "invitation"]);
export const broadcastStatus = pgEnum("broadcast_status", ["draft", "sending", "sent", "failed"]);
export const broadcastRecipientStatus = pgEnum("broadcast_recipient_status", [
  "pending",
  "sent",
  "failed",
]);

export const orgSettings = pgTable(
  "org_settings",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    plan: orgPlan("plan").notNull().default("free"),
    contactEmail: text("contact_email"),
    currency: text("currency").notNull().default("USD"),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    categoryConfigs: jsonb("category_configs")
      .$type<import("@workspace/contracts").CategoryConfigs>()
      .notNull()
      .default({}),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    emailTemplates: jsonb("email_templates").$type<Record<string, unknown>>().notNull().default({}),
    // Weekly broadcast send cap from an active capacity add-on. Null means no
    // add-on: the plan's base cap applies.
    broadcastWeeklyCap: integer("broadcast_weekly_cap"),
    // Contracted seat count for an enterprise org, set out-of-band when a deal is
    // signed. Caps membership and is the reconcile target that reverts customer seat
    // edits in the Polar portal. Null means uncapped (no contract limit set).
    enterpriseSeatLimit: integer("enterprise_seat_limit"),
    // Flipped true by the Resend webhook handler when complaint rate crosses
    // threshold. sendTenantEmail refuses to call Resend while this is true.
    // Operator clears via Drizzle Studio after reviewing.
    sendingSuspended: boolean("sending_suspended").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("org_settings_org_id_idx").on(table.orgId)],
);

export const subscriptionUsage = pgTable(
  "subscription_usage",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    periodStart: timestamp("period_start").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("subscription_usage_pk_idx").on(table.orgId, table.metric, table.periodStart),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: resourceType("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    email: text("email"),
    phone: text("phone"),
    capacity: integer("capacity"),
    url: text("url"),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    currency: text("currency"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("resources_org_id_idx").on(table.orgId),
    index("resources_org_type_idx").on(table.orgId, table.type),
    index("resources_org_archived_at_idx").on(table.orgId, table.archivedAt),
  ],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    notes: text("notes"),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    date: text("date").notNull(),
    time: time("time").notNull(),
    duration: integer("duration").notNull(),
    endDate: text("end_date"),
    endTime: time("end_time"),
    timezone: text("timezone").notNull().default("UTC"),
    allDay: boolean("all_day").notNull().default(false),
    maxCapacity: integer("max_capacity"),
    location: text("location"),
    locationLat: doublePrecision("location_lat"),
    locationLng: doublePrecision("location_lng"),
    status: eventStatus("status").notNull().default("upcoming"),
    visibility: eventVisibility("visibility").notNull().default("unpublished"),
    reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
    reviewStatus: eventReviewStatus("review_status").notNull().default("none"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at"),
    archivedAt: timestamp("archived_at"),
    recurring: boolean("recurring").notNull().default(false),
    recurrenceFrequency: text("recurrence_frequency"),
    recurrenceDays: jsonb("recurrence_days").$type<string[]>().notNull().default([]),
    recurrenceInterval: integer("recurrence_interval"),
    recurrenceEndDate: text("recurrence_end_date"),
    price: bigint("price", { mode: "number" }).notNull().default(0),
    imageUrl: text("image_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("events_org_id_idx").on(table.orgId),
    index("events_org_date_idx").on(table.orgId, table.date),
    index("events_org_status_idx").on(table.orgId, table.status),
    index("events_org_visibility_idx").on(table.orgId, table.visibility),
    index("events_org_archived_at_idx").on(table.orgId, table.archivedAt),
  ],
);

export const publicAssets = pgTable(
  "public_assets",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
    kind: publicAssetKind("kind").notNull(),
    assetRole: text("asset_role").notNull().default("cover"),
    key: text("key").notNull(),
    publicUrl: text("public_url").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    status: publicAssetStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("public_assets_org_id_idx").on(table.orgId),
    index("public_assets_event_id_idx").on(table.eventId),
    uniqueIndex("public_assets_key_idx").on(table.key),
  ],
);

export const eventResources = pgTable(
  "event_resources",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("event_resources_org_id_idx").on(table.orgId),
    index("event_resources_event_id_idx").on(table.eventId),
    uniqueIndex("event_resources_event_resource_role_idx").on(
      table.eventId,
      table.resourceId,
      table.role,
    ),
  ],
);

export const attendees = pgTable(
  "attendees",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    attendeeUserId: text("attendee_user_id").references(() => attendeeUser.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("attendees_org_id_idx").on(table.orgId),
    uniqueIndex("attendees_org_email_idx").on(table.orgId, table.email),
    index("attendees_user_id_idx").on(table.attendeeUserId),
  ],
);

export const registrations = pgTable(
  "registrations",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    attendeeId: text("attendee_id")
      .notNull()
      .references(() => attendees.id, { onDelete: "cascade" }),
    status: registrationStatus("status").notNull().default("confirmed"),
    paymentStatus: paymentStatus("payment_status").notNull().default("not_required"),
    checkoutSessionId: text("checkout_session_id"),
    paymentIntentId: text("payment_intent_id"),
    paymentProvider: text("payment_provider"),
    paymentExpiresAt: timestamp("payment_expires_at"),
    paymentIdempotencyKey: text("payment_idempotency_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("registrations_org_id_idx").on(table.orgId),
    index("registrations_event_id_idx").on(table.eventId),
    index("registrations_attendee_id_idx").on(table.attendeeId),
    index("registrations_payment_expires_idx").on(table.paymentExpiresAt),
    index("registrations_payment_intent_idx").on(table.paymentIntentId),
  ],
);

export const attendeePaymentProfiles = pgTable(
  "attendee_payment_profiles",
  {
    id: id(),
    attendeeId: text("attendee_id")
      .notNull()
      .references(() => attendees.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("attendee_payment_profiles_attendee_provider_idx").on(
      table.attendeeId,
      table.provider,
    ),
    index("attendee_payment_profiles_lookup_idx").on(
      table.orgId,
      table.provider,
      table.providerCustomerId,
    ),
  ],
);

export const paymentConnections = pgTable(
  "payment_connections",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    accountId: text("account_id").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("payment_connections_org_provider_idx").on(table.orgId, table.provider)],
);

export const stripePaymentAccounts = pgTable(
  "stripe_payment_accounts",
  {
    id: id(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => paymentConnections.id, { onDelete: "cascade" }),
    stripeUserId: text("stripe_user_id").notNull(),
    livemode: boolean("livemode").notNull(),
    scope: text("scope"),
    defaultCurrency: text("default_currency"),
    country: text("country"),
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    detailsSubmitted: boolean("details_submitted").notNull().default(false),
    email: text("email"),
    rawAccount: jsonb("raw_account").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("stripe_payment_accounts_connection_idx").on(table.connectionId),
    uniqueIndex("stripe_payment_accounts_user_idx").on(table.stripeUserId),
  ],
);

export const squarePaymentAccounts = pgTable(
  "square_payment_accounts",
  {
    id: id(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => paymentConnections.id, { onDelete: "cascade" }),
    merchantId: text("merchant_id").notNull(),
    locationId: text("location_id").notNull(),
    accessTokenEncrypted: byteaCol("access_token_encrypted").notNull(),
    refreshTokenEncrypted: byteaCol("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at").notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    shortLived: boolean("short_lived").notNull().default(false),
    environment: text("environment").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("square_payment_accounts_connection_idx").on(table.connectionId)],
);

export const paypalPaymentAccounts = pgTable(
  "paypal_payment_accounts",
  {
    id: id(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => paymentConnections.id, { onDelete: "cascade" }),
    merchantId: text("merchant_id").notNull(),
    trackingId: text("tracking_id").notNull(),
    grantedPermissions: jsonb("granted_permissions").$type<string[]>().notNull().default([]),
    paymentsReceivable: boolean("payments_receivable").notNull().default(false),
    primaryEmailConfirmed: boolean("primary_email_confirmed").notNull().default(false),
    oauthIntegrations: jsonb("oauth_integrations").$type<Record<string, unknown>>(),
    onboardingStatus: text("onboarding_status").notNull(),
    environment: text("environment").notNull(),
    lastStatusCheckAt: timestamp("last_status_check_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("paypal_payment_accounts_connection_idx").on(table.connectionId),
    uniqueIndex("paypal_payment_accounts_tracking_idx").on(table.trackingId),
  ],
);

export const emailEvent = pgTable(
  "email_event",
  {
    id: id(),
    // Nullable: platform mail (verify, password reset) is sent without an
    // org_id tag, so the webhook event lands with orgId=null.
    orgId: text("org_id").references(() => organization.id, { onDelete: "cascade" }),
    resendEmailId: text("resend_email_id").notNull(),
    // sent | bounced | complained | delivery_delayed
    eventType: text("event_type").notNull(),
    // invite | review-requested | review-approved | review-rejected | booking-resume
    // | booking-confirmed | event-reminder | null (platform)
    kind: text("kind"),
    toEmail: text("to_email").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_event_unique_idx").on(table.resendEmailId, table.eventType),
    index("email_event_org_received_idx").on(table.orgId, table.receivedAt),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    uniqueIndex("webhook_events_provider_event_idx").on(table.provider, table.providerEventId),
    index("webhook_events_provider_idx").on(table.provider),
  ],
);

export const paymentRefunds = pgTable(
  "payment_refunds",
  {
    id: id(),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerRefundId: text("provider_refund_id"),
    paymentReference: text("payment_reference").notNull(),
    requestedAmount: bigint("requested_amount", { mode: "number" }).notNull(),
    settledAmount: bigint("settled_amount", { mode: "number" }),
    currency: text("currency").notNull(),
    reason: text("reason"),
    status: text("status").notNull(),
    failureReason: text("failure_reason"),
    rawRequest: jsonb("raw_request").$type<Record<string, unknown>>(),
    rawResponse: jsonb("raw_response").$type<Record<string, unknown>>(),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    settledAt: timestamp("settled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("payment_refunds_registration_idx").on(table.registrationId),
    index("payment_refunds_payment_reference_idx").on(table.paymentReference),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: webhookDeliveryStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastAttemptAt: timestamp("last_attempt_at"),
    lastError: text("last_error"),
    responseStatus: integer("response_status"),
    durationMs: integer("duration_ms"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("webhook_deliveries_org_id_idx").on(table.orgId),
    index("webhook_deliveries_org_status_idx").on(table.orgId, table.status),
  ],
);

// One custom sending domain per org. The org gives us a domain, we register it in
// our Resend account, and store the DNS records the org must publish. Status tracks
// the path pending -> verifying -> active (or failed). Sent mail uses the domain
// only once it is active.
export const orgEmailDomains = pgTable(
  "org_email_domains",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    resendDomainId: text("resend_domain_id").notNull(),
    status: emailDomainStatus("status").notNull().default("pending"),
    dnsRecords: jsonb("dns_records")
      .$type<import("@workspace/contracts").EmailDnsRecord[]>()
      .notNull()
      .default([]),
    lastCheckedAt: timestamp("last_checked_at"),
    verifiedAt: timestamp("verified_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("org_email_domains_org_idx").on(table.orgId)],
);

// A newsletter or invitation an org composes and sends to a list. This is the
// only org-composed mail, and the only mail that counts toward the weekly send
// quota. The audience selector records who it targets; recipients are expanded
// into broadcast_recipients at send time.
export const broadcasts = pgTable(
  "broadcasts",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    kind: broadcastKind("kind").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    status: broadcastStatus("status").notNull().default("draft"),
    audience: jsonb("audience").$type<import("@workspace/contracts").BroadcastAudience>().notNull(),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    sentAt: timestamp("sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("broadcasts_org_idx").on(table.orgId)],
);

// One row per recipient of a broadcast. Tracks per-address send status so a retry
// does not send twice and so failures are visible.
export const broadcastRecipients = pgTable(
  "broadcast_recipients",
  {
    id: id(),
    broadcastId: text("broadcast_id")
      .notNull()
      .references(() => broadcasts.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    attendeeId: text("attendee_id").references(() => attendees.id, { onDelete: "set null" }),
    status: broadcastRecipientStatus("status").notNull().default("pending"),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("broadcast_recipients_unique_idx").on(table.broadcastId, table.email)],
);

export const videoConnections = pgTable(
  "video_connections",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: videoProvider("provider").notNull(),
    accountId: text("account_id").notNull(),
    status: videoConnectionStatus("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    revokedAt: timestamp("revoked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("video_connections_org_provider_idx").on(table.orgId, table.provider)],
);

export const zoomVideoAccounts = pgTable(
  "zoom_video_accounts",
  {
    id: id(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => videoConnections.id, { onDelete: "cascade" }),
    zoomUserId: text("zoom_user_id").notNull(),
    zoomAccountId: text("zoom_account_id").notNull(),
    email: text("email"),
    accountType: zoomAccountType("account_type").notNull().default("basic"),
    accessTokenEncrypted: byteaCol("access_token_encrypted").notNull(),
    refreshTokenEncrypted: byteaCol("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("zoom_video_accounts_connection_idx").on(table.connectionId),
    uniqueIndex("zoom_video_accounts_user_idx").on(table.zoomUserId),
  ],
);

export const eventVideo = pgTable(
  "event_video",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    provider: videoProvider("provider").notNull(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => videoConnections.id, { onDelete: "cascade" }),
    externalMeetingId: text("external_meeting_id").notNull(),
    externalMeetingUuid: text("external_meeting_uuid"),
    joinUrl: text("join_url").notNull(),
    hostStartUrlEncrypted: byteaCol("host_start_url_encrypted"),
    passcodeEncrypted: byteaCol("passcode_encrypted"),
    registrationEnabled: boolean("registration_enabled").notNull().default(false),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("event_video_event_idx").on(table.eventId),
    index("event_video_org_idx").on(table.orgId),
    index("event_video_connection_idx").on(table.connectionId),
    index("event_video_uuid_idx").on(table.externalMeetingUuid),
  ],
);

export const eventRegistrants = pgTable(
  "event_registrants",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    provider: videoProvider("provider").notNull(),
    externalRegistrantId: text("external_registrant_id"),
    joinUrlEncrypted: byteaCol("join_url_encrypted"),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    status: eventRegistrantStatus("status").notNull().default("registered"),
    attended: boolean("attended").notNull().default(false),
    joinTime: timestamp("join_time"),
    leaveTime: timestamp("leave_time"),
    durationSeconds: integer("duration_seconds"),
    ipAddress: text("ip_address"),
    country: text("country"),
    city: text("city"),
    device: text("device"),
    networkType: text("network_type"),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("event_registrants_event_registration_idx").on(table.eventId, table.registrationId),
    index("event_registrants_event_idx").on(table.eventId),
    index("event_registrants_org_idx").on(table.orgId),
    index("event_registrants_email_idx").on(table.eventId, table.email),
  ],
);

export const reminderKind = pgEnum("reminder_kind", ["t24h", "t1h"]);

export const registrationReminders = pgTable(
  "registration_reminders",
  {
    id: id(),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    kind: reminderKind("kind").notNull(),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("registration_reminders_reg_kind_idx").on(table.registrationId, table.kind),
  ],
);

export const polarSubscriptions = pgTable(
  "polar_subscriptions",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    polarCustomerId: text("polar_customer_id").notNull(),
    polarSubscriptionId: text("polar_subscription_id"),
    polarProductId: text("polar_product_id"),
    status: polarSubscriptionStatus("status").notNull().default("incomplete"),
    seatCount: integer("seat_count").notNull().default(1),
    // Billing cadence from Polar: "month" or "year". Null until a subscription syncs.
    recurringInterval: text("recurring_interval"),
    currentPeriodEnd: timestamp("current_period_end"),
    trialEndsAt: timestamp("trial_ends_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("polar_subscriptions_org_idx").on(table.orgId),
    index("polar_subscriptions_subscription_idx").on(table.polarSubscriptionId),
  ],
);
