import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type {
  CalendarSubscribeRequest,
  EventDto,
  PublicFeedResponse,
  PublicGlobalEventResponse,
  PublicOrgResponse,
  PublicRegistrationRequest,
  RegistrationDto,
  ResolveDomainResponse,
} from "@workspace/contracts";
import { api } from "./api";

type ServerRequestInfo = {
  forwardedHost: string | null;
  host: string | null;
  forwardedProto: string | null;
} | null;

const readServerRequestInfo = createIsomorphicFn()
  .client((): ServerRequestInfo => null)
  .server(
    (): ServerRequestInfo => ({
      forwardedHost: getRequestHeader("x-forwarded-host") ?? null,
      host: getRequestHeader("host") ?? null,
      forwardedProto: getRequestHeader("x-forwarded-proto") ?? null,
    }),
  );

export function getPublicOrg(slug: string) {
  return api.get<PublicOrgResponse>(`/api/public/orgs/${encodeURIComponent(slug)}`);
}

// Cross-org feed shown at /events on the main domain.
export function listGlobalPublicEvents() {
  return api.get<PublicFeedResponse>("/api/public/events");
}

// Event by id without an org slug; includes the org context and (if the org
// serves from its own domain) the origin to redirect to.
export function getGlobalPublicEvent(eventId: string) {
  return api.get<PublicGlobalEventResponse>(`/api/public/events/${encodeURIComponent(eventId)}`);
}

// Which org an arbitrary hostname (custom domain) belongs to.
export function resolvePublicDomain(host: string) {
  return api.get<ResolveDomainResponse>(
    `/api/public/domains/resolve?host=${encodeURIComponent(host)}`,
  );
}

export function listPublicEvents(slug: string) {
  return api.get<{ events: EventDto[] }>(`/api/public/orgs/${encodeURIComponent(slug)}/events`);
}

export function getPublicEvent(slug: string, eventId: string) {
  return api.get<{ event: EventDto }>(
    `/api/public/orgs/${encodeURIComponent(slug)}/events/${encodeURIComponent(eventId)}`,
  );
}

export function publicRegister(slug: string, eventId: string, input: PublicRegistrationRequest) {
  return api.post<{ registration: RegistrationDto }>(
    `/api/public/orgs/${encodeURIComponent(slug)}/events/${encodeURIComponent(eventId)}/register`,
    input,
  );
}

export function subscribeToOrgCalendar(slug: string, input: CalendarSubscribeRequest) {
  return api.post<{ subscribed: true }>(
    `/api/public/orgs/${encodeURIComponent(slug)}/calendar/subscribe`,
    input,
  );
}

export function startPublicCheckout(
  slug: string,
  eventId: string,
  body: { registrationId: string; successUrl: string; cancelUrl: string; provider?: string },
) {
  return api.post<{ url: string; sessionId: string }>(
    `/api/public/orgs/${encodeURIComponent(slug)}/events/${encodeURIComponent(eventId)}/checkout`,
    body,
  );
}

export type ResumeCheckoutResponse =
  | { url: string; sessionId: string }
  | { paid: true }
  | { expired: true };

export interface MyRegistrationItem {
  registration: RegistrationDto;
  event: {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string | null;
    imageUrl: string | null;
  };
  org: { id: string; name: string; slug: string | null };
}

export function listMyRegistrations() {
  return api.get<{ registrations: MyRegistrationItem[] }>(`/api/public/me/registrations`);
}

export function cancelMyRegistration(registrationId: string) {
  return api.post<{ registration: RegistrationDto }>(
    `/api/public/me/registrations/${encodeURIComponent(registrationId)}/cancel`,
    {},
  );
}

export function resumePublicCheckout(slug: string, eventId: string, token: string) {
  return api.post<ResumeCheckoutResponse>(
    `/api/public/orgs/${encodeURIComponent(slug)}/events/${encodeURIComponent(eventId)}/resume`,
    { token },
  );
}

const DEFAULT_PUBLIC_SITE_URL = "http://lvh.me:5678";

export function getPublicSiteUrl() {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_URL;
  try {
    return new URL(configured);
  } catch {
    return new URL(DEFAULT_PUBLIC_SITE_URL);
  }
}

export function getPublicSiteOrigin() {
  return getPublicSiteUrl().origin;
}

export function getPublicSiteHost() {
  return getPublicSiteUrl().host;
}

export function getPublicSiteHostname() {
  return getPublicSiteUrl().hostname;
}

export function getPublicHostname(): string | null {
  if (import.meta.env.SSR) return null;
  if (typeof window === "undefined") return null;
  return window.location.hostname;
}

export function getPublicOrigin(): string {
  const fallback = getPublicSiteOrigin();
  if (typeof window === "undefined") return fallback;
  return window.location.origin;
}

// Canonical share link for an event: the main-domain detail page. Orgs with an
// active custom domain get redirected there by the detail route, so this link
// is always valid to share.
export function getPublicEventUrl(eventId: string) {
  return `${getPublicSiteOrigin()}/events/${encodeURIComponent(eventId)}`;
}

// The main domain is the configured public site plus plain localhost during
// dev. Anything else reaching the app is a candidate customer domain.
export function isMainDomainHostname(hostname: string | null): boolean {
  if (!hostname) return true;
  return (
    hostname === getPublicSiteHostname() || hostname === "localhost" || hostname === "127.0.0.1"
  );
}

export interface PublicRequestInfo {
  origin: string;
  hostname: string | null;
  isMainDomain: boolean;
}

export function getPublicRequestInfo(): PublicRequestInfo {
  const serverInfo = readServerRequestInfo();
  if (serverInfo) {
    const host = cleanHostWithPort(serverInfo.forwardedHost ?? serverInfo.host);
    const hostname = cleanHost(host);
    const fallback = getPublicSiteOrigin();

    if (!host || !hostname) return { origin: fallback, hostname: null, isMainDomain: true };

    const proto = serverInfo.forwardedProto ?? (isLocalHost(host) ? "http" : "https");
    return {
      origin: `${proto}://${host}`,
      hostname,
      isMainDomain: isMainDomainHostname(hostname),
    };
  }

  const hostname = getPublicHostname();
  return {
    origin: getPublicOrigin(),
    hostname,
    isMainDomain: isMainDomainHostname(hostname),
  };
}

export const DEFAULT_CURRENCY = "USD";

/** The browser's IANA timezone (e.g. "Europe/Berlin"), falling back to UTC. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** All IANA timezones the runtime supports. */
export function listTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

/** Raw short offset for a timezone, e.g. "GMT+2" or "GMT+05:30". */
export function timezoneOffset(timezone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  } catch {
    return "GMT";
  }
}

/** A short offset + city label for a timezone, e.g. "GMT+2 · Berlin". */
export function timezoneLabel(timezone: string, at: Date = new Date()): string {
  const city = timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
  const offset = timezoneOffset(timezone, at);
  return offset ? `${offset} · ${city}` : city;
}

const POPULAR_TIMEZONES = [
  "America/Los_Angeles",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export interface TimezoneOption {
  tz: string;
  region: string;
  offset: string;
  popular: boolean;
}

/** Timezone options for a picker: popular zones first (in curated order), then the rest A–Z. */
export function timezoneOptions(): TimezoneOption[] {
  const toOption = (tz: string): TimezoneOption => ({
    tz,
    region: tz.replace(/_/g, " "),
    offset: timezoneOffset(tz),
    popular: POPULAR_TIMEZONES.includes(tz),
  });
  const all = listTimezones();
  const allSet = new Set(all);
  const popular = POPULAR_TIMEZONES.filter((tz) => allSet.has(tz)).map(toOption);
  const rest = all
    .filter((tz) => !POPULAR_TIMEZONES.includes(tz))
    .sort()
    .map(toOption);
  return [...popular, ...rest];
}

function decimalsFor(currency: string) {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Localized currency symbol (e.g. "$", "€", "¥"); falls back to the code. */
export function currencySymbol(currency: string, locale?: string) {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** All ISO 4217 currencies the runtime supports, with localized names. */
export function listCurrencies(locale?: string): { code: string; name: string }[] {
  const names = new Intl.DisplayNames(locale ? [locale] : undefined, { type: "currency" });
  return Intl.supportedValuesOf("currency").map((code) => ({
    code,
    name: names.of(code) ?? code,
  }));
}

export function centsToMajor(cents: number, currency: string) {
  const factor = 10 ** decimalsFor(currency);
  return cents / factor;
}

export function majorStringToCents(major: string, currency: string) {
  const factor = 10 ** decimalsFor(currency);
  const parsed = Number(String(major).trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * factor);
}

export function centsToMajorString(cents: number, currency: string) {
  const d = decimalsFor(currency);
  if (d === 0) return String(cents);
  return (cents / 10 ** d).toFixed(d);
}

export function formatPrice(cents: number, currency: string) {
  const amount = centsToMajor(cents, currency);
  if (!Number.isFinite(amount)) return String(cents);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(decimalsFor(currency))}`;
  }
}

function cleanHost(value: string | null | undefined) {
  const host = cleanHostWithPort(value);
  if (!host) return null;
  return host.split(":")[0] || null;
}

function cleanHostWithPort(value: string | null | undefined) {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function isLocalHost(host: string) {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".localhost") ||
    host.endsWith(".lvh.me")
  );
}
