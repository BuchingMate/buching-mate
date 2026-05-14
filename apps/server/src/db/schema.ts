export * from "./auth-schema";

import {
  bigint,
  boolean,
  customType,
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
export const eventStatus = pgEnum("event_status", ["upcoming", "completed", "cancelled"]);
export const eventVisibility = pgEnum("event_visibility", ["published", "unpublished"]);
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("org_settings_org_id_idx").on(table.orgId)],
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
    allDay: boolean("all_day").notNull().default(false),
    maxCapacity: integer("max_capacity"),
    location: text("location"),
    status: eventStatus("status").notNull().default("upcoming"),
    visibility: eventVisibility("visibility").notNull().default("unpublished"),
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
