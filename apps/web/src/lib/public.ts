import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type {
  EventDto,
  PublicOrgResponse,
  PublicRegistrationRequest,
  RegistrationDto,
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

export function getOrgPublicOrigin(orgSlug: string) {
  const siteUrl = getPublicSiteUrl();
  return `${siteUrl.protocol}//${orgSlug}.${siteUrl.host}`;
}

export function getOrgPublicUrl(orgSlug: string, path = "/events") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getOrgPublicOrigin(orgSlug)}${normalizedPath}`;
}

export function extractPublicSlug(hostname: string): string | null {
  const publicHostname = getPublicSiteHostname();
  const suffix = `.${publicHostname}`;
  if (!hostname.endsWith(suffix)) return null;

  const label = hostname.slice(0, -suffix.length);
  if (label && !label.includes(".")) return label;
  return null;
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

export function getPublicSlug(): string | null {
  const hostname = getPublicHostname();
  return hostname ? extractPublicSlug(hostname) : null;
}

export function getPublicSlugFromWindow(): string | null {
  return getPublicSlug();
}

export function isPublicSubdomain(hostname: string | null): boolean {
  if (!hostname) return false;
  return extractPublicSlug(hostname) !== null;
}

export function getPublicRequestInfo() {
  const serverInfo = readServerRequestInfo();
  if (serverInfo) {
    const host = cleanHostWithPort(serverInfo.forwardedHost ?? serverInfo.host);
    const hostname = cleanHost(host);
    const fallback = getPublicSiteOrigin();

    if (!host || !hostname) return { origin: fallback, hostname: null, slug: null };

    const proto = serverInfo.forwardedProto ?? (isLocalHost(host) ? "http" : "https");
    return {
      origin: `${proto}://${host}`,
      hostname,
      slug: extractPublicSlug(hostname),
    };
  }

  const hostname = getPublicHostname();
  return {
    origin: getPublicOrigin(),
    hostname,
    slug: hostname ? extractPublicSlug(hostname) : null,
  };
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "HUF", "TWD", "CLP", "ISK"]);

function decimalsFor(currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
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
