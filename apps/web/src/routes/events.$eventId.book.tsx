import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { makeAppHead } from "@/lib/seo";
import { ApiError } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice, getPublicOrigin, startPublicCheckout } from "@/lib/public";
import { usePublicRegister } from "@/hooks/use-public-register";
import {
  globalPublicEventQueryOptions,
  publicEventQueryOptions,
  publicOrgQueryOptions,
  resolvePublicContext,
} from "@/queries/public";
import { UnknownDomain } from "./~components/unknown-domain";

export const Route = createFileRoute("/events/$eventId/book")({
  component: PublicEventBook,
  loader: async ({ context, params }) => {
    const ctx = await resolvePublicContext(context.queryClient);
    let slug: string | null = null;
    if (ctx.mode === "org") {
      slug = ctx.slug;
    } else if (ctx.mode === "global") {
      const global = await context.queryClient.ensureQueryData(
        globalPublicEventQueryOptions(params.eventId),
      );
      if (global.customDomainOrigin) {
        throw redirect({ href: `${global.customDomainOrigin}/events/${params.eventId}/book` });
      }
      slug = global.org.slug;
    }
    if (!slug) return { slug: null, baseUrl: ctx.origin };
    const [orgData, eventData] = await Promise.all([
      context.queryClient.ensureQueryData(publicOrgQueryOptions(slug)),
      context.queryClient.ensureQueryData(publicEventQueryOptions(slug, params.eventId)),
    ]);
    return { slug, baseUrl: ctx.origin, orgData, eventData };
  },
  head: ({ loaderData, params }) => {
    const event = loaderData && "eventData" in loaderData ? loaderData.eventData?.event : undefined;
    return makeAppHead({
      title: event ? `Book ${event.title}` : "Book event",
      description: event?.description ?? "Enter your details to reserve a spot.",
      baseUrl: loaderData?.baseUrl,
      path: `/events/${params.eventId}/book`,
      noIndex: true,
    });
  },
});

function PublicEventBook() {
  const { slug } = Route.useLoaderData();
  const { eventId } = Route.useParams();
  if (!slug) return <UnknownDomain />;
  return <PublicEventBookContent slug={slug} eventId={eventId} />;
}

function formatBookDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatBookTime(time: string) {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function PublicEventBookContent({ slug, eventId }: { slug: string; eventId: string }) {
  const { data: eventData } = useSuspenseQuery(publicEventQueryOptions(slug, eventId));
  const { data: orgData } = useSuspenseQuery(publicOrgQueryOptions(slug));

  const event = eventData.event;
  const orgName = orgData.org.name;
  const isPaid = event.price > 0;
  const currency = orgData.settings?.currency ?? "USD";
  // Waitlist is opt-in per event: full without it = no more bookings (the
  // API refuses with 409 event_full too; this just spares the form).
  const soldOut =
    event.maxCapacity !== null &&
    event.maxCapacity - event.confirmedRegistrations <= 0 &&
    !event.waitlistEnabled;

  const register = usePublicRegister(slug, eventId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subscribe, setSubscribe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await register.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() === "" ? null : phone.trim(),
        subscribeToCalendar: subscribe,
      });

      if (!isPaid) return;

      setCheckoutPending(true);
      const origin = getPublicOrigin();
      const rid = result.registration.id;
      try {
        const checkout = await startPublicCheckout(slug, eventId, {
          registrationId: rid,
          successUrl: `${origin}/events/${eventId}/return?status=success&rid=${rid}`,
          cancelUrl: `${origin}/events/${eventId}/return?status=cancel&rid=${rid}`,
        });
        window.location.assign(checkout.url);
      } catch (checkoutErr) {
        setCheckoutPending(false);
        const msg =
          checkoutErr instanceof ApiError ? checkoutErr.message : "Couldn't start payment.";
        setError(
          `Registered, but ${msg.toLowerCase()} Reach out to the organizer with reference ${rid}.`,
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to register. Try again.");
      }
    }
  };

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/75">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link
            to="/events/$eventId"
            params={{ eventId }}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← {event.title}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-8">
        {soldOut ? (
          <Alert>
            <AlertDescription>This event is full and not taking new bookings.</AlertDescription>
          </Alert>
        ) : checkoutPending ? (
          <Alert>
            <AlertDescription>Redirecting to payment…</AlertDescription>
          </Alert>
        ) : !isPaid && register.data ? (
          <Alert>
            <AlertDescription>
              {register.data.registration.status === "confirmed"
                ? "You're registered. Confirmation will follow by email."
                : register.data.registration.status === "waitlisted"
                  ? "Event is full — you're on the waitlist."
                  : "Registration received."}
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Register
              </CardDescription>
              <CardTitle className="font-heading text-2xl tracking-[-0.03em]">
                {event.title}
              </CardTitle>
              <CardDescription>
                {formatBookDate(event.date)} · {formatBookTime(event.time)}
                {event.location ? ` · ${event.location}` : ""}
                {isPaid ? ` · ${formatPrice(event.price, currency)}` : " · Free"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Name</Label>
                  <Input
                    id="reg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-phone">Phone (optional)</Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={subscribe}
                    onCheckedChange={(checked) => setSubscribe(Boolean(checked))}
                  />
                  <span className="leading-5 text-muted-foreground">
                    Subscribe to {orgName}'s Calendar to hear about future events. You can
                    unsubscribe anytime.
                  </span>
                </label>

                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={register.isPending || checkoutPending}
                >
                  {register.isPending
                    ? "Registering…"
                    : checkoutPending
                      ? "Redirecting…"
                      : isPaid
                        ? `Continue to payment`
                        : "Register"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
