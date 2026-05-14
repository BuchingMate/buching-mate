import { queryOptions } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { attendeeAuthClient } from "@/lib/attendee-auth-client";
import { getCurrentOrg } from "@/lib/org";

export const authKeys = {
  session: ["auth", "session"] as const,
  currentOrg: ["auth", "current-org"] as const,
  attendeeSession: ["auth", "attendee-session"] as const,
};

export const sessionQueryOptions = queryOptions({
  queryKey: authKeys.session,
  queryFn: async () => {
    const result = await authClient.getSession();
    return result.data ?? null;
  },
  staleTime: 1000 * 60 * 5,
});

export const currentOrgQueryOptions = queryOptions({
  queryKey: authKeys.currentOrg,
  queryFn: getCurrentOrg,
  staleTime: 1000 * 60 * 5,
});

export const attendeeSessionQueryOptions = queryOptions({
  queryKey: authKeys.attendeeSession,
  queryFn: async () => {
    const result = await attendeeAuthClient.getSession();
    return result.data ?? null;
  },
  staleTime: 1000 * 60 * 5,
});
