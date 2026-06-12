import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    // Main domain root → global events feed; a custom domain root → that org's
    // events (same route, resolved by hostname).
    throw redirect({ to: "/events" });
  },
});
