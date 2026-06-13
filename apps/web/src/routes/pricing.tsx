import { createFileRoute, redirect } from "@tanstack/react-router";
import { makeAppHead } from "@/lib/seo";
import { BUSINESS_NAME } from "@/lib/branding";
import { getPublicOrigin, getPublicRequestInfo } from "@/lib/public";
import { publicPricingQueryOptions } from "@/queries/public";
import { PricingPage } from "./~components/pricing-page";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  beforeLoad: () => {
    // Marketing pages live on the main domain only. Org custom domains redirect
    // back to their events feed.
    const { isMainDomain } = getPublicRequestInfo();
    if (!isMainDomain) throw redirect({ to: "/events" });
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(publicPricingQueryOptions);
  },
  head: () =>
    makeAppHead({
      title: `Pricing — ${BUSINESS_NAME}`,
      description:
        "Free to start. Team and Enterprise plans for organizers running events at scale. No setup fees, cancel anytime.",
      baseUrl: getPublicOrigin(),
      path: "/pricing",
    }),
});
