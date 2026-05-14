import { queryOptions } from "@tanstack/react-query";
import { getPublicEvent, getPublicOrg, listPublicEvents } from "@/lib/public";

export const publicKeys = {
  all: ["public"] as const,
  org: (slug: string) => [...publicKeys.all, "org", slug] as const,
  events: (slug: string) => [...publicKeys.all, "events", slug] as const,
  event: (slug: string, eventId: string) => [...publicKeys.all, "event", slug, eventId] as const,
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
