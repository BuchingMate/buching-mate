import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ApiError } from "@/lib/api";
import { currentOrgQueryOptions } from "@/queries/auth";

export const Route = createFileRoute("/_auth/admin")({
  beforeLoad: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(currentOrgQueryOptions);
    } catch (error) {
      if (error instanceof ApiError && error.code === "organization_required") {
        throw redirect({ to: "/onboarding" });
      }
      throw error;
    }
  },
  component: () => <Outlet />,
});
