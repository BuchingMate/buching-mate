import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getPublicRequestInfo, getPublicSiteOrigin } from "@/lib/public";
import { sessionQueryOptions } from "@/queries/auth";

export const Route = createFileRoute("/_auth")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { slug } = await getPublicRequestInfo();
    if (slug) {
      throw redirect({ href: `${getPublicSiteOrigin()}/login` });
    }
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
