import { queryOptions } from "@tanstack/react-query";
import { getAttendee, listAttendeeRegistrations, listAttendees } from "@/lib/attendees";

export const attendeeKeys = {
  all: ["attendees"] as const,
  lists: () => [...attendeeKeys.all, "list"] as const,
  list: (search?: string | null) => [...attendeeKeys.lists(), search ?? ""] as const,
  detail: (attendeeId: string) => [...attendeeKeys.all, "detail", attendeeId] as const,
  registrations: (attendeeId: string) =>
    [...attendeeKeys.all, "registrations", attendeeId] as const,
};

export const attendeesQueryOptions = (search?: string | null) =>
  queryOptions({
    queryKey: attendeeKeys.list(search),
    queryFn: () => listAttendees(search),
  });

export const attendeeQueryOptions = (attendeeId: string) =>
  queryOptions({
    queryKey: attendeeKeys.detail(attendeeId),
    queryFn: () => getAttendee(attendeeId),
  });

export const attendeeRegistrationsQueryOptions = (attendeeId: string) =>
  queryOptions({
    queryKey: attendeeKeys.registrations(attendeeId),
    queryFn: () => listAttendeeRegistrations(attendeeId),
  });
