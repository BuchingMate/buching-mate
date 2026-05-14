import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { EventDto } from "@workspace/contracts";
import { makeAppHead } from "@/lib/seo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPrice, getPublicRequestInfo } from "@/lib/public";
import { publicEventsQueryOptions, publicOrgQueryOptions } from "@/queries/public";
import { NoSubdomainPlaceholder } from "./~components/no-subdomain";
import { PUBLIC_ALL_CATEGORIES, PublicBrandBar } from "./~components/public-brand-bar";

export const Route = createFileRoute("/events/")({
  component: PublicOrgEvents,
  loader: async ({ context }) => {
    const { origin: baseUrl, slug } = await getPublicRequestInfo();
    if (!slug) return { slug: null as string | null, baseUrl };
    const [orgData, eventsData] = await Promise.all([
      context.queryClient.ensureQueryData(publicOrgQueryOptions(slug)),
      context.queryClient.ensureQueryData(publicEventsQueryOptions(slug)),
    ]);
    return { slug, baseUrl, orgData, eventsData };
  },
  head: ({ loaderData }) => {
    const orgName = loaderData?.orgData?.org.name;
    const title = orgName ? `${orgName} Events` : "Events";
    const description = orgName
      ? `Browse upcoming events from ${orgName}.`
      : "Browse upcoming events.";

    return makeAppHead({
      title,
      description,
      baseUrl: loaderData?.baseUrl,
      path: "/events",
      noIndex: !loaderData?.slug,
    });
  },
});

const ALL_CATEGORIES = PUBLIC_ALL_CATEGORIES;

function PublicOrgEvents() {
  const { slug } = Route.useLoaderData();
  if (!slug) return <NoSubdomainPlaceholder />;
  return <PublicOrgEventsContent slug={slug} />;
}

function PublicOrgEventsContent({ slug }: { slug: string }) {
  const { data: orgData } = useSuspenseQuery(publicOrgQueryOptions(slug));
  const { data: eventsData } = useSuspenseQuery(publicEventsQueryOptions(slug));

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const currency = orgData.settings?.currency ?? "USD";
  const categories = orgData.settings?.categories ?? [];

  const sortedEvents = useMemo(() => {
    return [...eventsData.events].sort((a, b) => {
      const aKey = `${a.date}T${a.time}`;
      const bKey = `${b.date}T${b.time}`;
      return aKey.localeCompare(bKey);
    });
  }, [eventsData.events]);

  const hero = useMemo(() => {
    const withImage = sortedEvents.find((e) => e.imageUrl);
    return withImage ?? sortedEvents[0] ?? null;
  }, [sortedEvents]);

  const visibleEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedEvents.filter((event) => {
      if (hero && event.id === hero.id) return false;
      if (category !== ALL_CATEGORIES && event.category !== category) return false;
      if (!term) return true;
      const haystack = `${event.title} ${event.description ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [sortedEvents, hero, search, category]);

  const filtered = search.trim().length > 0 || category !== ALL_CATEGORIES;

  return (
    <div className="min-h-svh bg-background">
      <PublicBrandBar
        orgName={orgData.org.name}
        logo={orgData.org.logo}
        contactEmail={orgData.settings?.contactEmail ?? null}
        searchProps={{ search, setSearch, category, setCategory, categories }}
      />

      {hero ? <HeroEvent event={hero} currency={currency} /> : null}

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-heading text-2xl font-semibold uppercase tracking-tight sm:text-3xl">
            {hero ? "More events" : "Upcoming events"}
          </h2>
          <span className="text-sm text-muted-foreground">
            {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}
          </span>
        </div>

        {visibleEvents.length === 0 ? (
          <Alert>
            <AlertDescription>
              {filtered
                ? "No events match your filters."
                : hero
                  ? "No other events scheduled. Check back soon."
                  : "No events scheduled. Check back soon."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEvents.map((event) => (
              <PublicEventCard key={event.id} event={event} currency={currency} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function HeroEvent({ event, currency }: { event: EventDto; currency: string }) {
  const dateLabel = formatDate(event.date);
  const timeLabel = formatTime(event.time);
  const priceLabel = event.price > 0 ? `Tickets from ${formatPrice(event.price, currency)}` : "Get tickets";

  return (
    <section className="relative w-full overflow-hidden bg-muted">
      <div className="relative mx-auto h-[440px] max-w-7xl">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-primary/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

        <div className="relative flex h-full flex-col justify-end px-8 pb-12 sm:px-12 sm:pb-14">
          <div className="max-w-2xl text-white">
            {event.category ? (
              <div className="mb-3 inline-block bg-primary px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-primary-foreground">
                {event.category}
              </div>
            ) : null}
            <h1 className="font-heading text-4xl font-semibold uppercase leading-[1.05] tracking-tight sm:text-6xl">
              {event.title}
            </h1>
            <p className="mt-4 text-base text-white/90 sm:text-lg">
              {dateLabel} · {timeLabel}
              {event.location ? ` · ${event.location}` : ""}
            </p>
            <Link
              to="/events/$eventId"
              params={{ eventId: event.id }}
              className="mt-6 inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {priceLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicEventCard({ event, currency }: { event: EventDto; currency: string }) {
  const remaining =
    event.maxCapacity === null
      ? null
      : Math.max(0, event.maxCapacity - event.confirmedRegistrations);
  const full = remaining !== null && remaining === 0;
  const low = remaining !== null && remaining > 0 && remaining <= 5;
  const dateLabel = formatDate(event.date);
  const timeLabel = formatTime(event.time);
  const priceLabel = event.price > 0 ? formatPrice(event.price, currency) : "Free";

  const kicker = full ? "Waitlist only" : low ? `Only ${remaining} left` : event.category ?? event.location;
  const kickerUrgent = full || low;

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="group block focus:outline-none"
    >
      <div className="aspect-[16/10] overflow-hidden rounded-md bg-muted">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-foreground/30">
            <CalendarDays className="size-12" />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {kicker ? (
          <div
            className={
              kickerUrgent
                ? "text-2xs font-semibold uppercase tracking-wider text-primary"
                : "text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
            }
          >
            {kicker}
          </div>
        ) : null}
        <h3 className="font-heading text-xl font-semibold uppercase leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-2">
          {event.title}
        </h3>
        <div className="text-sm font-semibold text-foreground">
          {dateLabel} · {timeLabel}
        </div>
        {event.location && !kickerUrgent && kicker !== event.location ? (
          <div className="text-sm text-muted-foreground">{event.location}</div>
        ) : null}
        <div className="pt-1 text-sm font-semibold text-primary">{priceLabel}</div>
      </div>
    </Link>
  );
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
