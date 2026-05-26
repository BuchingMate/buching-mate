import { queryOptions } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { authClient } from "@/lib/auth-client";
import { attendeeAuthClient } from "@/lib/attendee-auth-client";
import { getCurrentOrg } from "@/lib/org";

export const authKeys = {
  session: ["auth", "session"] as const,
  currentOrg: ["auth", "current-org"] as const,
  attendeeSession: ["auth", "attendee-session"] as const,
};

// On the server the auth client has no browser cookie jar, so forward the
// incoming request's cookie header. On the client it returns undefined and the
// browser attaches cookies automatically.
const sessionFetchOptions = createIsomorphicFn()
  .client(() => undefined)
  .server(() => {
    const cookie = getRequestHeader("cookie");
    return cookie ? { fetchOptions: { headers: { cookie } } } : undefined;
  });

export const sessionQueryOptions = queryOptions({
  queryKey: authKeys.session,
  queryFn: async () => {
    const result = await authClient.getSession(sessionFetchOptions());
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
