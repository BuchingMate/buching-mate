import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { makeAppHead } from "@/lib/seo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { getPublicOrigin, getPublicRequestInfo, startPublicCheckout } from "@/lib/public";
import { NoSubdomainPlaceholder } from "./~components/no-subdomain";

const searchSchema = z.object({
  status: z.enum(["success", "cancel"]).optional(),
  rid: z.string().optional(),
});

export const Route = createFileRoute("/events/$eventId/return")({
  validateSearch: searchSchema,
  component: PublicEventReturn,
  loader: async ({ params }) => {
    const { origin: baseUrl, slug } = await getPublicRequestInfo();
    return { slug, baseUrl, eventId: params.eventId };
  },
  head: ({ loaderData }) => {
    return makeAppHead({
      title: "Booking status",
      description: "Result of your booking payment.",
      baseUrl: loaderData?.baseUrl,
      path: `/events/${loaderData?.eventId}/return`,
      noIndex: true,
    });
  },
});

function PublicEventReturn() {
  const { slug } = Route.useLoaderData();
  const { eventId } = Route.useParams();
  const search = Route.useSearch();

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
        <ReturnBody slug={slug} eventId={eventId} status={search.status} rid={search.rid} />
      </main>
    </div>
  );
}

function ReturnBody({
  slug,
  eventId,
  status,
  rid,
}: {
  slug: string;
  eventId: string;
  status: "success" | "cancel" | undefined;
  rid: string | undefined;
}) {
  if (status === "success") {
    return (
      <Alert>
        <AlertDescription>Payment received. Confirmation will follow by email.</AlertDescription>
      </Alert>
    );
  }

  if (status === "cancel") {
    return <CancelCard slug={slug} eventId={eventId} rid={rid} />;
  }

  return (
    <Alert>
      <AlertDescription>Booking status unknown.</AlertDescription>
    </Alert>
  );
}

function CancelCard({
  slug,
  eventId,
  rid,
}: {
  slug: string;
  eventId: string;
  rid: string | undefined;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    if (!rid) return;
    setPending(true);
    setError(null);
    try {
      const origin = getPublicOrigin();
      const checkout = await startPublicCheckout(slug, eventId, {
        registrationId: rid,
        successUrl: `${origin}/events/${eventId}/return?status=success&rid=${rid}`,
        cancelUrl: `${origin}/events/${eventId}/return?status=cancel&rid=${rid}`,
      });
      window.location.assign(checkout.url);
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : "Couldn't start payment. Try again later.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment cancelled</CardTitle>
        <CardDescription>
          Your booking is held as pending — retry within 30 minutes or it will expire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={retry} disabled={!rid || pending} className="w-full">
          {pending ? "Redirecting…" : "Retry payment"}
        </Button>
        {!rid ? (
          <p className="text-xs text-muted-foreground">
            Missing reference id. Open the booking link from your event page again.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
