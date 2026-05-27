export interface HealthResponse {
  status: "ok";
}

export interface RootResponse {
  ok: boolean;
  service: string;
}

export type OrgRole = "owner" | "admin" | "manager" | "viewer";
export type OrgPlan = "free" | "team" | "enterprise";
export type ResourceType = "instructor" | "material" | "location" | "equipment" | "custom";
export type EventStatus = "upcoming" | "completed" | "cancelled";
export type EventVisibility = "published" | "unpublished";
export type EventReviewStatus = "none" | "pending" | "approved" | "rejected";
export type RegistrationStatus = "pending" | "confirmed" | "waitlisted" | "cancelled";
export type PaymentStatus = "not_required" | "pending" | "paid" | "refunded" | "expired" | "failed";
export type PublicAssetKind = "org_logo" | "event_image";
export type PublicAssetRole = "cover" | "detail";
export type PublicAssetStatus = "pending" | "ready";

export const PAYMENT_PROVIDERS = ["stripe", "square", "paypal"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return typeof value === "string" && (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

export function parsePaymentProvider(value: unknown): PaymentProvider {
  if (!isPaymentProvider(value)) {
    throw new Error(`unknown payment provider: ${String(value)}`);
  }
  return value;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface PaymentRefundDto {
  id: string;
  registrationId: string;
  provider: PaymentProvider;
  providerRefundId: string | null;
  paymentReference: string;
  requestedAmount: number;
  settledAmount: number | null;
  currency: string;
  reason: string | null;
  status: "pending" | "succeeded" | "failed" | "canceled";
  failureReason: string | null;
  requestedByUserId: string | null;
  requestedAt: string;
  settledAt: string | null;
}
export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "dead_letter";

export type EmailDomainStatus = "pending" | "verifying" | "active" | "failed";

// One DNS record an org must publish to verify a custom sending domain. Mirrors
// the shape Resend returns for a domain's records.
export interface EmailDnsRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

export interface EmailDomainDto {
  domain: string;
  status: EmailDomainStatus;
  dnsRecords: EmailDnsRecord[];
  verifiedAt: string | null;
}

export type BroadcastKind = "newsletter" | "invitation";
export type BroadcastStatus = "draft" | "sending" | "sent" | "failed";

// Who a broadcast targets. "event_guests" needs an eventId; "all_attendees"
// reaches everyone the org has registered before.
export type BroadcastAudience =
  | { type: "event_guests"; eventId: string }
  | { type: "all_attendees" };

export interface BroadcastDto {
  id: string;
  kind: BroadcastKind;
  eventId: string | null;
  subject: string;
  bodyHtml: string;
  status: BroadcastStatus;
  audience: BroadcastAudience;
  recipientCount: number;
  sentCount: number;
  sentAt: string | null;
  createdAt: string;
}

export interface CreateBroadcastRequest {
  kind: BroadcastKind;
  subject: string;
  bodyHtml: string;
  audience: BroadcastAudience;
}

// Weekly send allowance by plan before any add-on. Only newsletters and
// all-attendee blasts count toward it; sends to a specific event's guests are
// always free and never counted.
export const FREE_WEEKLY_SENDS = 500;
export const TEAM_INCLUDED_WEEKLY_SENDS = 5000;

// Paid capacity add-ons (Luma-style). Each raises an org's weekly ceiling to its
// full `weeklyCap` (the tier is the total, not added to the base). `slug` matches
// the Polar checkout product slug; `monthlyPriceCents` is for display only.
export interface BroadcastTier {
  slug: string;
  weeklyCap: number;
  monthlyPriceCents: number;
}

export const BROADCAST_TIERS: readonly BroadcastTier[] = [
  { slug: "broadcasts-10k", weeklyCap: 10_000, monthlyPriceCents: 5_000 },
  { slug: "broadcasts-25k", weeklyCap: 25_000, monthlyPriceCents: 20_000 },
  { slug: "broadcasts-50k", weeklyCap: 50_000, monthlyPriceCents: 40_000 },
  { slug: "broadcasts-75k", weeklyCap: 75_000, monthlyPriceCents: 60_000 },
  { slug: "broadcasts-100k", weeklyCap: 100_000, monthlyPriceCents: 80_000 },
] as const;

// Base weekly send cap for a plan, before any capacity add-on. Enterprise is
// effectively unlimited.
export function baseWeeklySends(plan: OrgPlan): number {
  if (plan === "free") return FREE_WEEKLY_SENDS;
  if (plan === "team") return TEAM_INCLUDED_WEEKLY_SENDS;
  return Number.MAX_SAFE_INTEGER;
}

// Admin-seat allowances. A seat is consumed by owner/admin members only. Mirrors
// the server constants in ee/billing/polar.ts so the web can render plan copy
// without importing server code.
export const FREE_SEAT_CAP = 3;
export const TEAM_INCLUDED_SEATS = 5;

// Team plan pricing for one billing interval, fetched live from Polar (the source
// of truth) and surfaced to the upgrade card. Amounts are in minor units (cents).
export interface PlanPricing {
  interval: "month" | "year";
  basePriceCents: number;
  includedSeats: number;
  extraSeatPriceCents: number;
  currency: string;
}

export interface PlanPricingResponse {
  monthly: PlanPricing | null;
  annual: PlanPricing | null;
}

// What the Team plan includes, for the upgrade card checklist. Real features only.
export const TEAM_BENEFITS: readonly string[] = [
  `${TEAM_INCLUDED_SEATS} admin seats included`,
  "Unlimited managers & viewers",
  `${TEAM_INCLUDED_WEEKLY_SENDS.toLocaleString("en-US")} broadcast sends per week`,
  "Send email from your own domain",
  "Custom subdomain",
] as const;

// Current subscription summary for the plan card. All fields null when the org has
// no Polar subscription row yet (e.g. Free).
export interface SubscriptionInfo {
  plan: OrgPlan;
  status: string | null;
  interval: "month" | "year" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// A past charge on the org's Polar account, for the billing-history table.
export interface BillingHistoryItem {
  id: string;
  date: string;
  amountCents: number;
  currency: string;
  status: string;
  paid: boolean;
  invoiceAvailable: boolean;
}

// An org's reusable email template settings. The same brand wraps every
// newsletter and invitation the org sends.
export interface EmailBranding {
  accentColor: string | null;
  logoUrl: string | null;
  footerText: string | null;
}

export const EMPTY_EMAIL_BRANDING: EmailBranding = {
  accentColor: null,
  logoUrl: null,
  footerText: null,
};

function escapeBrandingHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Accept only a hex colour like #rrggbb; fall back to the calm default ink so a
// bad value never breaks the layout or injects markup.
export function brandingAccent(color: string | null | undefined): string {
  const fallback = "#1f2430";
  if (!color) return fallback;
  const value = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

// Wrap an org's message in its branded email shell. Shared by the server (real
// send) and the web composer (live preview) so the preview is exact. bodyHtml is
// the org's own content and is inserted as written.
export function renderBroadcastEmail(opts: {
  subject: string;
  bodyHtml: string;
  orgName: string;
  branding: EmailBranding;
}): string {
  const accent = brandingAccent(opts.branding.accentColor);
  const orgName = escapeBrandingHtml(opts.orgName);
  const footer = (opts.branding.footerText ?? "").trim();
  const masthead = opts.branding.logoUrl
    ? `<img src="${escapeBrandingHtml(opts.branding.logoUrl)}" alt="${orgName}" style="max-height:34px;display:block;" />`
    : `<span style="font-size:16px;font-weight:600;color:#1f2430;letter-spacing:-0.01em;">${orgName}</span>`;

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2430;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e2d9;">
            <tr><td style="height:4px;background:${accent};"></td></tr>
            <tr><td style="padding:24px 32px 0 32px;">${masthead}</td></tr>
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#1f2430;">${escapeBrandingHtml(opts.subject)}</h1>
                <div style="font-size:15px;line-height:1.6;color:#3b4150;">${opts.bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px 32px;">
                <div style="border-top:1px solid #ece8e0;padding-top:16px;font-size:12px;line-height:1.5;color:#8a8578;">
                  ${footer ? escapeBrandingHtml(footer) : `Sent by ${orgName}`}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: string;
}

export interface CategoryConfig {
  color?: string;
  icon?: string;
}

export type CategoryConfigs = Record<string, CategoryConfig>;

export interface OrgSettingsDto {
  id: string;
  orgId: string;
  plan: OrgPlan;
  contactEmail: string | null;
  currency: string;
  categories: string[];
  categoryConfigs: CategoryConfigs;
  webhookUrl: string | null;
  webhookSecret: string | null;
  emailBranding: EmailBranding;
  // Effective weekly broadcast send cap: the plan base, or the active add-on
  // tier when one is subscribed.
  broadcastWeeklyCap: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDto {
  id: string;
  orgId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: OrgRole;
  createdAt: string;
}

// Seat usage for an org. A seat is consumed by owner/admin members only; cap is
// null when uncapped (enterprise with no contracted limit).
export interface SeatUsageDto {
  used: number;
  cap: number | null;
  plan: OrgPlan;
}

export interface ResourceDto {
  id: string;
  orgId: string;
  type: ResourceType;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  capacity: number | null;
  url: string | null;
  cost: string | null;
  currency: string | null;
  notes: string | null;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceUsageDto {
  eventResourceId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventStatus: EventStatus;
  role: string;
  quantity: number;
}

export interface EventDto {
  id: string;
  orgId: string;
  createdById: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  tags: string[];
  date: string;
  time: string;
  duration: number;
  endDate: string | null;
  endTime: string | null;
  timezone: string;
  allDay: boolean;
  maxCapacity: number | null;
  location: string | null;
  locationLat: number | null;
  locationLng: number | null;
  status: EventStatus;
  visibility: EventVisibility;
  reviewerId: string | null;
  reviewStatus: EventReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  archivedAt: string | null;
  recurring: boolean;
  recurrenceFrequency: string | null;
  recurrenceDays: string[];
  recurrenceInterval: number | null;
  recurrenceEndDate: string | null;
  price: number;
  imageUrl: string | null;
  detailImages: EventImageDto[];
  video?: EventVideoSummary | null;
  confirmedRegistrations: number;
  waitlistedRegistrations: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventImageDto {
  id: string;
  url: string;
}

export interface EventVideoSummary {
  provider: "zoom";
  meetingId: string;
  joinUrl: string;
}

export interface PublicAssetDto {
  id: string;
  orgId: string;
  eventId: string | null;
  kind: PublicAssetKind;
  role: PublicAssetRole;
  key: string;
  publicUrl: string;
  contentType: string;
  size: number;
  status: PublicAssetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventResourceDto {
  id: string;
  orgId: string;
  eventId: string;
  resourceId: string;
  role: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendeeDto {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationDto {
  id: string;
  orgId: string;
  eventId: string;
  attendeeId: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  paymentProvider: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendeePaymentProfileDto {
  id: string;
  attendeeId: string;
  orgId: string;
  provider: string;
  providerCustomerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationWithAttendeeDto extends RegistrationDto {
  attendee: AttendeeDto;
}

export interface RegistrationWithEventDto extends RegistrationDto {
  event: EventDto;
}

export interface PaymentConnectionDto {
  id: string;
  orgId: string;
  provider: string;
  accountId: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryDto {
  id: string;
  orgId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  responseStatus: number | null;
  durationMs: number | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceRequest {
  type: ResourceType;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  capacity?: number | null;
  url?: string | null;
  cost?: string | null;
  currency?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export type UpdateResourceRequest = Partial<CreateResourceRequest>;

export interface CreateEventRequest {
  title: string;
  description?: string | null;
  notes?: string | null;
  category?: string | null;
  tags?: string[];
  date: string;
  time: string;
  duration: number;
  endDate?: string | null;
  endTime?: string | null;
  timezone?: string;
  allDay?: boolean;
  maxCapacity?: number | null;
  location?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  status?: EventStatus;
  visibility?: EventVisibility;
  reviewerId?: string | null;
  videoProvider?: "zoom" | null;
  recurring?: boolean;
  recurrenceFrequency?: string | null;
  recurrenceDays?: string[];
  recurrenceInterval?: number | null;
  recurrenceEndDate?: string | null;
  price?: number;
  imageUrl?: string | null;
}

export type UpdateEventRequest = Partial<CreateEventRequest> & {
  archivedAt?: string | null;
};

export interface CreateAttendeeRequest {
  name: string;
  email: string;
  phone?: string | null;
}

export type UpdateAttendeeRequest = Partial<CreateAttendeeRequest>;

export interface CreateRegistrationRequest {
  eventId: string;
  attendeeId: string;
  status?: RegistrationStatus;
  paymentStatus?: PaymentStatus;
}

export type UpdateRegistrationRequest = Partial<
  Pick<CreateRegistrationRequest, "status" | "paymentStatus">
>;

export interface PublicRegistrationRequest {
  name: string;
  email: string;
  phone?: string | null;
}

export interface UpdateEventResourcesRequest {
  resources: Array<{
    resourceId: string;
    role: string;
    quantity?: number;
  }>;
}

export interface UpdateOrgSettingsRequest {
  contactEmail?: string | null;
  currency?: string;
  categories?: string[];
  categoryConfigs?: CategoryConfigs;
  webhookUrl?: string | null;
  emailTemplates?: Record<string, unknown>;
  emailBranding?: EmailBranding;
}

export interface CreatePublicAssetUploadRequest {
  kind: PublicAssetKind;
  role?: PublicAssetRole;
  fileName: string;
  contentType: string;
  size: number;
  eventId?: string | null;
}

export interface CreatePublicAssetUploadResponse {
  assetId: string;
  uploadUrl: string;
  publicUrl: string;
  expiresAt: string;
}

export interface ListEventsResponse {
  events: EventDto[];
}

export interface PublicOrgResponse {
  org: OrganizationDto;
  settings: Pick<OrgSettingsDto, "contactEmail" | "currency" | "categories"> | null;
}

export interface PublicEventResponse {
  event: EventDto;
  resources: EventResourceDto[];
}

export interface DashboardSummaryResponse {
  eventCount: number;
  attendeeCount: number;
  registrationCount: number;
  upcomingEventCount: number;
}
