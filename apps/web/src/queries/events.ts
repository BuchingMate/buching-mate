import { queryOptions } from "@tanstack/react-query";
import { getEvent, listEvents } from "@/lib/events";

export const eventKeys = {
  all: ["events"] as const,
  lists: () => [...eventKeys.all, "list"] as const,
  list: () => [...eventKeys.lists()] as const,
  details: () => [...eventKeys.all, "detail"] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
};

export const eventsQueryOptions = queryOptions({
  queryKey: eventKeys.list(),
  queryFn: listEvents,
});

export const eventQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => getEvent(eventId),
  });
