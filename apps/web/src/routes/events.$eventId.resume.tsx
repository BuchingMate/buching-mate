import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { makeAppHead } from "@/lib/seo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { getPublicRequestInfo, resumePublicCheckout } from "@/lib/public";
import { NoSubdomainPlaceholder } from "./~components/no-subdomain";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/events/$eventId/resume")({
  validateSearch: searchSchema,
  component: PublicEventResume,
  loader: async ({ params }) => {
    const { origin: baseUrl, slug } = await getPublicRequestInfo();
    return { slug, baseUrl, eventId: params.eventId };
  },
  head: ({ loaderData }) => {
    return makeAppHead({
      title: "Resume booking",
      description: "Continue your booking payment.",
      baseUrl: loaderData?.baseUrl,
      path: `/events/${loaderData?.eventId}/resume`,
      noIndex: true,
    });
  },
});

type State = { kind: "loading" } | { kind: "expired" } | { kind: "error"; message: string };

function PublicEventResume() {
  const { slug } = Route.useLoaderData();
  const { eventId } = Route.useParams();
  const { token } = Route.useSearch();

  if (!slug) return <NoSubdomainPlaceholder />;

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link to="/events/$eventId" params={{ eventId }} className="text-sm underline">
            ← Back to event
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-8">
        <ResumeBody slug={slug} eventId={eventId} token={token} />
      </main>
    </div>
  );
}

function ResumeBody({
  slug,
  eventId,
  token,
}: {
  slug: string;
  eventId: string;
  token: string | undefined;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Missing token in link." });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await resumePublicCheckout(slug, eventId, token);
        if (cancelled) return;
        if ("url" in result) {
          window.location.assign(result.url);
          return;
        }
        if ("paid" in result) {
          window.location.assign(`/events/${eventId}/return?status=success`);
          return;
        }
        setState({ kind: "expired" });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "invalid_resume_token") {
          setState({ kind: "expired" });
          return;
        }
        setState({
          kind: "error",
          message: err instanceof ApiError ? err.message : "Couldn't resume booking.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, eventId, token]);

  if (state.kind === "loading") {
    return (
      <Alert>
        <AlertDescription>Resuming your booking…</AlertDescription>
      </Alert>
    );
  }

  if (state.kind === "expired") {
    return (
      <Alert>
        <AlertDescription className="space-y-3">
          <p>This payment link has expired.</p>
          <Link to="/events/$eventId" params={{ eventId }}>
            <Button size="sm">Return to event</Button>
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
