import { createFileRoute, redirect } from "@tanstack/react-router";
import { makeAppHead } from "@/lib/seo";
import { BUSINESS_NAME } from "@/lib/branding";
import { getPublicOrigin, getPublicRequestInfo } from "@/lib/public";
import { LandingPage } from "./~components/landing-page";

export const Route = createFileRoute("/")({
  component: LandingPage,
  beforeLoad: () => {
    // Org custom domains have no marketing site — their root goes straight to
    // that org's events. The main domain serves the marketing landing page.
    const { isMainDomain } = getPublicRequestInfo();
    if (!isMainDomain) throw redirect({ to: "/events" });
  },
  head: () =>
    makeAppHead({
      title: `${BUSINESS_NAME} — Event booking & registration`,
      description:
        "Polished event pages, painless registration, and built-in payments. Run events people actually show up to.",
      baseUrl: getPublicOrigin(),
      path: "/",
    }),
});
