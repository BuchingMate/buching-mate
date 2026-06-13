import { queryOptions, type QueryClient } from "@tanstack/react-query";
import {
  getGlobalPublicEvent,
  getPublicEvent,
  getPublicOrg,
  getPublicPricing,
  getPublicRequestInfo,
  listGlobalPublicEvents,
  listPublicEvents,
  resolvePublicDomain,
} from "@/lib/public";

export const publicKeys = {
  all: ["public"] as const,
  org: (slug: string) => [...publicKeys.all, "org", slug] as const,
  events: (slug: string) => [...publicKeys.all, "events", slug] as const,
  event: (slug: string, eventId: string) => [...publicKeys.all, "event", slug, eventId] as const,
  feed: () => [...publicKeys.all, "feed"] as const,
  pricing: () => [...publicKeys.all, "pricing"] as const,
  globalEvent: (eventId: string) => [...publicKeys.all, "global-event", eventId] as const,
  domain: (host: string) => [...publicKeys.all, "domain", host] as const,
};

export const publicOrgQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: publicKeys.org(slug),
    queryFn: () => getPublicOrg(slug),
  });

export const publicEventsQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: publicKeys.events(slug),
    queryFn: () => listPublicEvents(slug),
  });

export const publicEventQueryOptions = (slug: string, eventId: string) =>
  queryOptions({
    queryKey: publicKeys.event(slug, eventId),
    queryFn: () => getPublicEvent(slug, eventId),
  });

export const publicFeedQueryOptions = queryOptions({
  queryKey: publicKeys.feed(),
  queryFn: () => listGlobalPublicEvents(),
});

export const publicPricingQueryOptions = queryOptions({
  queryKey: publicKeys.pricing(),
  queryFn: () => getPublicPricing(),
  staleTime: 5 * 60 * 1000,
});

export const globalPublicEventQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: publicKeys.globalEvent(eventId),
    queryFn: () => getGlobalPublicEvent(eventId),
  });

export const domainResolveQueryOptions = (host: string) =>
  queryOptions({
    queryKey: publicKeys.domain(host),
    queryFn: () => resolvePublicDomain(host),
    staleTime: 5 * 60 * 1000,
  });

// Which public surface this request is on. "global" = the main domain (shared
// cross-org feed); "org" = an active customer domain serving one org; "unknown"
// = a hostname we don't recognize (e.g. a removed custom domain).
export type PublicContext =
  | { mode: "global"; origin: string }
  | { mode: "org"; slug: string; origin: string }
  | { mode: "unknown"; origin: string };

export async function resolvePublicContext(queryClient: QueryClient): Promise<PublicContext> {
  const { origin, hostname, isMainDomain } = getPublicRequestInfo();
  if (isMainDomain || !hostname) return { mode: "global", origin };
  const resolved = await queryClient.ensureQueryData(domainResolveQueryOptions(hostname));
  if (resolved.slug) return { mode: "org", slug: resolved.slug, origin };
  return { mode: "unknown", origin };
}
