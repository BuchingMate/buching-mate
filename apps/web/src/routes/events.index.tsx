import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import type { EventDto } from "@workspace/contracts";
import { makeAppHead } from "@/lib/seo";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_CURRENCY, formatPrice } from "@/lib/public";
import {
  publicEventsQueryOptions,
  publicFeedQueryOptions,
  publicOrgQueryOptions,
  resolvePublicContext,
} from "@/queries/public";
import { CalendarSubscribe } from "./~components/calendar-subscribe";
import { DateGroupedEventList, formatTime, type EventListEntry } from "./~components/event-list";
import { PUBLIC_ALL_CATEGORIES, PublicBrandBar } from "./~components/public-brand-bar";
import { PlatformBrandBar } from "./~components/platform-brand-bar";
import { UnknownDomain } from "./~components/unknown-domain";

export const Route = createFileRoute("/events/")({
  component: PublicEvents,
  loader: async ({ context }) => {
    const ctx = await resolvePublicContext(context.queryClient);
    if (ctx.mode === "org") {
      const [orgData, eventsData] = await Promise.all([
        context.queryClient.ensureQueryData(publicOrgQueryOptions(ctx.slug)),
        context.queryClient.ensureQueryData(publicEventsQueryOptions(ctx.slug)),
      ]);
      return { mode: ctx.mode, slug: ctx.slug, baseUrl: ctx.origin, orgData, eventsData };
    }
    if (ctx.mode === "global") {
      await context.queryClient.ensureQueryData(publicFeedQueryOptions);
      return { mode: ctx.mode, slug: null, baseUrl: ctx.origin };
    }
    return { mode: ctx.mode, slug: null, baseUrl: ctx.origin };
  },
  head: ({ loaderData }) => {
    const orgName =
      loaderData && "orgData" in loaderData ? loaderData.orgData?.org.name : undefined;
    const title = orgName ? `${orgName} Events` : "Discover events";
    const description = orgName
      ? `Browse upcoming events from ${orgName}.`
      : "Browse and book upcoming events.";

    return makeAppHead({
      title,
      description,
      baseUrl: loaderData?.baseUrl,
      path: "/events",
      noIndex: loaderData?.mode === "unknown",
    });
  },
});

const ALL_CATEGORIES = PUBLIC_ALL_CATEGORIES;

function PublicEvents() {
  const loaderData = Route.useLoaderData();
  if (loaderData.mode === "unknown") return <UnknownDomain />;
  if (loaderData.mode === "org" && loaderData.slug) {
    return <PublicOrgEventsContent slug={loaderData.slug} />;
  }
  return <GlobalEventsFeed />;
}

function GlobalEventsFeed() {
  const { data: feed } = useSuspenseQuery(publicFeedQueryOptions);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const entries = useMemo<EventListEntry[]>(
    () =>
      feed.events.map((item) => ({
        event: item.event,
        currency: item.org.currency,
        orgName: item.org.name,
      })),
    [feed.events],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (entry.event.category) set.add(entry.event.category);
    }
    return Array.from(set).sort();
  }, [entries]);

  const visibleEntries = useMemo(
    () => filterEntries(entries, search, category),
    [entries, search, category],
  );

  const filtered = search.trim().length > 0 || category !== ALL_CATEGORIES;

  return (
    <div className="min-h-svh bg-background">
      <PlatformBrandBar />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 sm:pt-12">
        <header className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Discover events
          </h1>
          <p className="text-base text-muted-foreground">
            Workshops, classes, and sessions from every organizer, in one place.
          </p>
        </header>

        <FilterRow
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          categories={categories}
          count={visibleEntries.length}
        />

        {visibleEntries.length === 0 ? (
          <FeedEmptyState filtered={filtered} />
        ) : (
          <div className="mt-8">
            <DateGroupedEventList entries={visibleEntries} />
          </div>
        )}
      </main>
    </div>
  );
}

function PublicOrgEventsContent({ slug }: { slug: string }) {
  const { data: orgData } = useSuspenseQuery(publicOrgQueryOptions(slug));
  const { data: eventsData } = useSuspenseQuery(publicEventsQueryOptions(slug));

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const currency = orgData.settings?.currency ?? DEFAULT_CURRENCY;
  const categories = orgData.settings?.categories ?? [];

  const entries = useMemo<EventListEntry[]>(
    () => eventsData.events.map((event) => ({ event, currency })),
    [eventsData.events, currency],
  );

  const sortedEvents = useMemo(() => {
    return [...eventsData.events].sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
    );
  }, [eventsData.events]);

  const hero = useMemo(() => {
    const withImage = sortedEvents.find((e) => e.imageUrl);
    return withImage ?? sortedEvents[0] ?? null;
  }, [sortedEvents]);

  const visibleEntries = useMemo(
    () =>
      filterEntries(entries, search, category).filter(
        (entry) => !hero || entry.event.id !== hero.id,
      ),
    [entries, search, category, hero],
  );

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

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {hero ? "More events" : "Upcoming events"}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {visibleEntries.length} {visibleEntries.length === 1 ? "event" : "events"}
            </span>
            <CalendarSubscribe slug={slug} orgName={orgData.org.name} />
          </div>
        </div>

        {visibleEntries.length === 0 ? (
          <FeedEmptyState filtered={filtered} hasHero={Boolean(hero)} />
        ) : (
          <DateGroupedEventList entries={visibleEntries} />
        )}
      </main>
    </div>
  );
}

function FilterRow({
  search,
  setSearch,
  category,
  setCategory,
  categories,
  count,
}: {
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  categories: string[];
  count: number;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events or organizers"
          className="h-9 rounded-full pl-9"
        />
      </div>
      {categories.length > 0 ? (
        <Select value={category} onValueChange={(v) => setCategory(v ?? ALL_CATEGORIES)}>
          <SelectTrigger className="h-9 w-44 rounded-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <span className="ml-auto text-sm text-muted-foreground">
        {count} {count === 1 ? "event" : "events"}
      </span>
    </div>
  );
}

function FeedEmptyState({ filtered, hasHero }: { filtered: boolean; hasHero?: boolean }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
      <CalendarDays className="mx-auto size-8 text-muted-foreground/60" />
      <h3 className="mt-3 text-lg font-semibold tracking-tight">
        {filtered ? "No matching events" : "Nothing scheduled yet"}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {filtered
          ? "Try a different search or category."
          : hasHero
            ? "No other events on the calendar. Check back soon."
            : "New events land here as organizers publish them. Check back soon."}
      </p>
    </div>
  );
}

function filterEntries(entries: EventListEntry[], search: string, category: string) {
  const term = search.trim().toLowerCase();
  return entries.filter(({ event, orgName }) => {
    if (category !== ALL_CATEGORIES && event.category !== category) return false;
    if (!term) return true;
    const haystack = `${event.title} ${event.description ?? ""} ${orgName ?? ""}`.toLowerCase();
    return haystack.includes(term);
  });
}

function HeroEvent({ event, currency }: { event: EventDto; currency: string }) {
  const dateLabel = formatDate(event.date);
  const timeLabel = formatTime(event.time);
  const priceLabel =
    event.price > 0 ? `Tickets from ${formatPrice(event.price, currency)}` : "Get tickets";

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
              <div className="mb-3 inline-flex h-6 items-center rounded-full bg-white/15 px-3 text-xs font-semibold text-white">
                {event.category}
              </div>
            ) : null}
            <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              {event.title}
            </h1>
            <p className="mt-4 text-base text-white/90 sm:text-lg">
              {dateLabel} · {timeLabel}
              {event.location ? ` · ${event.location}` : ""}
            </p>
            <Link
              to="/events/$eventId"
              params={{ eventId: event.id }}
              className="mt-6 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {priceLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
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
