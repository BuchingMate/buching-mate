import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getPublicRequestInfo, getPublicSiteOrigin } from "@/lib/public";
import { attendeeSessionQueryOptions } from "@/queries/auth";

export const Route = createFileRoute("/_attendee")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    // Attendee sessions live on the main domain only; bounce custom domains.
    const { isMainDomain } = await getPublicRequestInfo();
    if (!isMainDomain) {
      throw redirect({ href: `${getPublicSiteOrigin()}/me` });
    }
    const session = await context.queryClient.ensureQueryData(attendeeSessionQueryOptions);
    if (!session) {
      throw redirect({ to: "/login", search: { as: "attendee" } });
    }
  },
  component: () => <Outlet />,
});
