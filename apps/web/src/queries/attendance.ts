import { queryOptions } from "@tanstack/react-query";
import { listEventAttendance } from "@/lib/attendance";

export const attendanceKeys = {
  all: ["attendance"] as const,
  event: (eventId: string) => [...attendanceKeys.all, "event", eventId] as const,
};

export function eventAttendanceQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: attendanceKeys.event(eventId),
    queryFn: () => listEventAttendance(eventId),
  });
}
