import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getPublicRequestInfo } from "@/lib/public";
import { attendeeSessionQueryOptions } from "@/queries/auth";

export const Route = createFileRoute("/_attendee")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { slug } = await getPublicRequestInfo();
    if (!slug) {
      throw redirect({ to: "/login" });
    }
    const session = await context.queryClient.ensureQueryData(attendeeSessionQueryOptions);
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
