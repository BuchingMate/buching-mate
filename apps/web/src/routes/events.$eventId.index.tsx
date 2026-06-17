import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, MapPin, Tag, Ticket, Users } from "lucide-react";
import { makeAppHead } from "@/lib/seo";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { DEFAULT_CURRENCY, formatPrice } from "@/lib/public";
import {
  globalPublicEventQueryOptions,
  publicEventQueryOptions,
  publicOrgQueryOptions,
  resolvePublicContext,
} from "@/queries/public";
import { PublicBrandBar } from "./~components/public-brand-bar";
import { PlatformBrandBar } from "./~components/platform-brand-bar";
import { UnknownDomain } from "./~components/unknown-domain";

export const Route = createFileRoute("/events/$eventId/")({
  component: PublicEventDetail,
  loader: async ({ context, params }) => {
    const ctx = await resolvePublicContext(context.queryClient);
    let slug: string | null = null;
    if (ctx.mode === "org") {
      slug = ctx.slug;
    } else if (ctx.mode === "global") {
      const global = await context.queryClient.ensureQueryData(
        globalPublicEventQueryOptions(params.eventId),
      );
      // Orgs with their own domain serve event pages there exclusively.
      if (global.customDomainOrigin) {
        throw redirect({ href: `${global.customDomainOrigin}/events/${params.eventId}` });
      }
      slug = global.org.slug;
    }
    if (!slug) return { slug: null, surface: "platform" as const, baseUrl: ctx.origin };
    const surface = ctx.mode === "org" ? ("org" as const) : ("platform" as const);
    const [orgData, eventData] = await Promise.all([
      context.queryClient.ensureQueryData(publicOrgQueryOptions(slug)),
      context.queryClient.ensureQueryData(publicEventQueryOptions(slug, params.eventId)),
    ]);
    return { slug, surface, baseUrl: ctx.origin, orgData, eventData };
  },
  head: ({ loaderData, params }) => {
    const event = loaderData && "eventData" in loaderData ? loaderData.eventData?.event : undefined;
    const orgName =
      loaderData && "orgData" in loaderData ? loaderData.orgData?.org.name : undefined;

    return makeAppHead({
      title: event?.title ?? "Event",
      description: getEventDescription(event, orgName),
      baseUrl: loaderData?.baseUrl,
      path: `/events/${params.eventId}`,
      image: event?.imageUrl ?? null,
      imageAlt: event?.title ?? null,
      type: "article",
      noIndex: !loaderData?.slug || !event,
    });
  },
});

function PublicEventDetail() {
  const { slug, surface } = Route.useLoaderData();
  const { eventId } = Route.useParams();
  if (!slug) return <UnknownDomain />;
  return <PublicEventDetailContent slug={slug} eventId={eventId} surface={surface} />;
}

function PublicEventDetailContent({
  slug,
  eventId,
  surface,
}: {
  slug: string;
  eventId: string;
  surface: "org" | "platform";
}) {
  const { data: orgData } = useSuspenseQuery(publicOrgQueryOptions(slug));
  const { data: eventData } = useSuspenseQuery(publicEventQueryOptions(slug, eventId));

  const event = eventData.event;
  const currency = orgData.settings?.currency ?? DEFAULT_CURRENCY;
  const isPaid = event.price > 0;
  const galleryImages = [
    ...(event.imageUrl ? [{ id: "cover", url: event.imageUrl }] : []),
    ...event.detailImages,
  ];
  const extraGallery = galleryImages.slice(1);
  const remaining =
    event.maxCapacity === null
      ? null
      : Math.max(0, event.maxCapacity - event.confirmedRegistrations);
  const full = remaining !== null && remaining === 0;
  const low = remaining !== null && remaining > 0 && remaining <= 5;

  const tile = dateTile(event.date);
  const dayLabel = dayName(event.date);
  const dateLabel = `${dayLabel}, ${tile.month} ${tile.day}`;
  const timeRange = formatTimeRange(event.date, event.time, event.endTime, event.timezone);
  const priceLabel = isPaid ? formatPrice(event.price, currency) : "Free";
  // Waitlist is opt-in per event: a full event without it is simply sold out.
  const soldOut = full && !event.waitlistEnabled;
  const ctaLabel = full ? "Join waitlist" : isPaid ? "Get tickets" : "Register";
  const contactEmail = orgData.settings?.contactEmail ?? null;
  const hasMap = event.locationLat !== null && event.locationLng !== null;
  const tagList = event.tags.length > 0 ? event.tags : event.category ? [event.category] : [];

  return (
    <div className="min-h-svh bg-background">
      {surface === "org" ? (
        <PublicBrandBar
          orgName={orgData.org.name}
          logo={orgData.org.logo}
          contactEmail={contactEmail}
        />
      ) : (
        <PlatformBrandBar width="wide" />
      )}

      <main className="mx-auto max-w-5xl px-6 py-8">
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/events" className="hover:text-foreground hover:underline">
            Events
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="truncate text-foreground">{event.title}</span>
        </nav>

        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[300px_1fr]">
          {/* Left sidebar: poster, host, attendance, location */}
          <aside className="space-y-6">
            <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 p-6 text-center">
                  <span className="font-heading text-2xl font-semibold leading-tight tracking-tight text-primary/70">
                    {event.title}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hosted by
              </h2>
              <div className="flex items-center gap-3 border-t border-border pt-3">
                {orgData.org.logo ? (
                  <img
                    src={orgData.org.logo}
                    alt=""
                    className="size-8 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-semibold text-primary/70">
                    {orgData.org.name.trim()[0]?.toUpperCase() ?? "•"}
                  </span>
                )}
                <span className="truncate text-sm font-semibold text-foreground">
                  {orgData.org.name}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                <span>
                  <span className="font-semibold text-foreground">
                    {event.confirmedRegistrations}
                  </span>{" "}
                  going
                </span>
              </div>
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="block text-muted-foreground hover:text-foreground hover:underline"
                >
                  Contact the host
                </a>
              ) : null}
            </div>

            {tagList.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    <Tag className="size-3" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {event.location ? (
              <div className="space-y-3 border-t border-border pt-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Location
                </h2>
                <div className="text-sm font-semibold text-foreground">{event.location}</div>
                {hasMap ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${event.locationLat},${event.locationLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-border"
                  >
                    <iframe
                      title="Event location map"
                      className="pointer-events-none h-44 w-full"
                      loading="lazy"
                      src={`https://www.google.com/maps?q=${event.locationLat},${event.locationLng}&z=15&output=embed`}
                    />
                  </a>
                ) : (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Open in Maps
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ) : null}
          </aside>

          {/* Right column: title, when/where, registration, about */}
          <div className="space-y-7">
            <div className="space-y-3">
              {event.category ? (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {event.category}
                </span>
              ) : null}
              <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                {event.title}
              </h1>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card text-center leading-none">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {tile.month}
                  </span>
                  <span className="font-heading text-lg font-semibold tabular-nums">
                    {tile.day}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{dateLabel}</div>
                  <div className="text-sm text-muted-foreground">{timeRange}</div>
                </div>
              </div>

              {event.location ? (
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                    <MapPin className="size-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 text-sm font-semibold text-foreground">
                    {event.location}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border bg-muted/40 px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">Registration</h2>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Ticket className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {soldOut ? "Event Full" : full ? "Event Full" : priceLabel}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {soldOut
                        ? "Registration is closed."
                        : full
                          ? "If you'd like, you can join the waitlist."
                          : low
                            ? `Only ${remaining} spots left.`
                            : remaining !== null
                              ? `${remaining} spots left.`
                              : "Spots available."}
                    </div>
                  </div>
                </div>

                {soldOut ? (
                  <span className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    Event full
                  </span>
                ) : (
                  <Link
                    to="/events/$eventId/book"
                    params={{ eventId }}
                    className="flex h-11 w-full items-center justify-center gap-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {ctaLabel}
                    <ChevronRight className="size-4" />
                  </Link>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <h2 className="font-heading text-lg font-semibold tracking-tight">About Event</h2>
              {event.description ? (
                <p className="max-w-[70ch] whitespace-pre-line text-base leading-relaxed text-foreground">
                  {event.description}
                </p>
              ) : (
                <p className="text-base text-muted-foreground">No description provided.</p>
              )}

              {extraGallery.length > 0 ? (
                <div className="pt-4">
                  <h3 className="mb-3 font-heading text-base font-semibold tracking-tight">
                    Gallery
                  </h3>
                  <EventImageGallery images={extraGallery} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function EventImageGallery({ images }: { images: Array<{ id: string; url: string }> }) {
  if (images.length === 1) {
    return (
      <div className="aspect-[16/9] overflow-hidden rounded-md border bg-muted/30">
        <img src={images[0].url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <Carousel className="overflow-hidden rounded-md border bg-muted/30">
      <CarouselContent className="ms-0">
        {images.map((image, index) => (
          <CarouselItem key={image.id} className="relative ps-0">
            <div className="aspect-[16/9]">
              <img src={image.url} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="absolute bottom-3 right-3 rounded-full bg-background/90 px-2 py-1 text-xs font-medium shadow-sm">
              {index + 1} / {images.length}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-3 bg-background/90" />
      <CarouselNext className="right-3 bg-background/90" />
    </Carousel>
  );
}

function dateTile(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: date, month: "", year: "" };
  return {
    day: d.getDate().toString(),
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    year: d.getFullYear().toString(),
  };
}

function dayName(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

// Wall-clock time strings ("16:00") are already in the event's timezone, so we
// format the digits directly and append the zone abbreviation separately.
function formatTime(time: string) {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function tzAbbrev(date: string, timezone: string) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function formatTimeRange(date: string, time: string, endTime: string | null, timezone: string) {
  const start = formatTime(time);
  const abbrev = tzAbbrev(date, timezone);
  const end = endTime ? ` - ${formatTime(endTime.slice(0, 5))}` : "";
  return `${start}${end}${abbrev ? ` ${abbrev}` : ""}`;
}

function getEventDescription(
  event:
    | {
        title: string;
        description: string | null;
        date: string;
        time: string;
        location: string | null;
      }
    | undefined,
  orgName: string | undefined,
) {
  if (!event) return "View event details and registration information.";
  if (event.description) return event.description;

  const host = orgName ? ` from ${orgName}` : "";
  const location = event.location ? ` at ${event.location}` : "";
  return `${event.title}${host} on ${event.date} at ${event.time}${location}.`;
}
