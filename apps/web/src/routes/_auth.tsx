import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getPublicRequestInfo, getPublicSiteOrigin } from "@/lib/public";
import { sessionQueryOptions } from "@/queries/auth";

export const Route = createFileRoute("/_auth")({
  ssr: "data-only",
  beforeLoad: async ({ context }) => {
    // Staff admin lives on the main domain only; custom domains are public-only.
    const { isMainDomain } = await getPublicRequestInfo();
    if (!isMainDomain) {
      throw redirect({ href: `${getPublicSiteOrigin()}/login` });
    }
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
