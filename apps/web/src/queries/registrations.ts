import { queryOptions } from "@tanstack/react-query";
import { listEventRegistrations } from "@/lib/registrations";
import { eventKeys } from "./events";

export const registrationKeys = {
  all: ["registrations"] as const,
  lists: () => [...registrationKeys.all, "list"] as const,
  list: (eventId: string) => [...eventKeys.detail(eventId), "registrations"] as const,
};

export const eventRegistrationsQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: registrationKeys.list(eventId),
    queryFn: () => listEventRegistrations(eventId),
  });
