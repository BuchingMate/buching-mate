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
  allDay: boolean;
  maxCapacity: number | null;
  location: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  archivedAt: string | null;
  recurring: boolean;
  recurrenceFrequency: string | null;
  recurrenceDays: string[];
  recurrenceInterval: number | null;
  recurrenceEndDate: string | null;
  price: number;
  imageUrl: string | null;
  detailImages: EventImageDto[];
  confirmedRegistrations: number;
  waitlistedRegistrations: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventImageDto {
  id: string;
  url: string;
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
  allDay?: boolean;
  maxCapacity?: number | null;
  location?: string | null;
  status?: EventStatus;
  visibility?: EventVisibility;
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
