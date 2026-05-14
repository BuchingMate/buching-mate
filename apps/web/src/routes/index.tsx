import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublicRequestInfo } from "@/lib/public";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { slug } = await getPublicRequestInfo();
    throw redirect({ to: slug ? "/me" : "/admin" });
  },
});
