import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
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
  const timeLabel = formatTime(event.time);
  const priceLabel = isPaid ? formatPrice(event.price, currency) : "Free";
  // Waitlist is opt-in per event: a full event without it is simply sold out.
  const soldOut = full && !event.waitlistEnabled;
  const ctaLabel = full ? "Join waitlist" : isPaid ? "Get tickets" : "Register";

  return (
    <div className="min-h-svh bg-background">
      {surface === "org" ? (
        <PublicBrandBar
          orgName={orgData.org.name}
          logo={orgData.org.logo}
          contactEmail={orgData.settings?.contactEmail ?? null}
        />
      ) : (
        <PlatformBrandBar width="wide" />
      )}

      {event.imageUrl ? (
        <section className="relative w-full overflow-hidden bg-muted">
          <div className="relative mx-auto h-[360px] max-w-5xl sm:rounded-b-2xl sm:h-[420px] overflow-hidden">
            <img
              src={event.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
            <div className="relative flex h-full flex-col justify-end px-6 pb-10 sm:px-10">
              <div className="max-w-3xl text-white">
                {event.category ? (
                  <div className="text-sm font-medium text-white/85">{event.category}</div>
                ) : null}
                <h1 className="mt-1 font-heading text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                  {event.title}
                </h1>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <main className="mx-auto max-w-5xl px-6 py-10">
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/events" className="hover:text-foreground hover:underline">
            Events
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="truncate text-foreground">{event.title}</span>
        </nav>

        {!event.imageUrl ? (
          <header className="mb-8 max-w-3xl">
            {event.category ? (
              <div className="text-sm font-medium text-muted-foreground">{event.category}</div>
            ) : null}
            <h1 className="mt-1 font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              {event.title}
            </h1>
          </header>
        ) : null}

        <div className="flex items-center gap-3">
          {orgData.org.logo ? (
            <img
              src={orgData.org.logo}
              alt=""
              className="size-9 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-semibold text-primary/70">
              {orgData.org.name.trim()[0]?.toUpperCase() ?? "•"}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Hosted by</div>
            <div className="truncate text-sm font-semibold text-foreground">{orgData.org.name}</div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex w-24 shrink-0 flex-col items-center rounded-lg bg-muted px-3 py-3 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tile.month}
              </span>
              <span className="font-heading text-3xl font-semibold leading-none tabular-nums tracking-tight">
                {tile.day}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{tile.year}</span>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{dayLabel}</span>
                <span className="mx-1.5">·</span>
                <span>{timeLabel}</span>
                <span className="mx-1.5">·</span>
                <span>{event.duration} min</span>
              </div>
              {event.location ? (
                <div className="text-base font-semibold text-foreground">{event.location}</div>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm">
                <span className="font-semibold text-foreground">{priceLabel}</span>
                {full ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                    {soldOut ? "Sold out" : "Waitlist open"}
                  </span>
                ) : low ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                    Only {remaining} left
                  </span>
                ) : remaining !== null ? (
                  <span className="text-xs text-muted-foreground">{remaining} spots left</span>
                ) : null}
              </div>
            </div>

            {soldOut ? (
              <span className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-muted px-6 text-sm font-semibold text-muted-foreground">
                Event full
              </span>
            ) : (
              <Link
                to="/events/$eventId/book"
                params={{ eventId }}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {ctaLabel}
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-heading text-lg font-semibold tracking-tight">About this event</h3>
            {event.description ? (
              <p className="max-w-[70ch] whitespace-pre-line text-base leading-relaxed text-foreground">
                {event.description}
              </p>
            ) : (
              <p className="text-base text-muted-foreground">No description provided.</p>
            )}

            {extraGallery.length > 0 ? (
              <div className="pt-6">
                <h4 className="mb-3 font-heading text-base font-semibold tracking-tight">
                  Gallery
                </h4>
                <EventImageGallery images={extraGallery} />
              </div>
            ) : null}
          </div>

          <aside className="space-y-4">
            <h3 className="font-heading text-lg font-semibold tracking-tight">Event info</h3>
            <dl className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
              <InfoRow label="When" value={`${dayLabel}, ${tile.month} ${tile.day} ${tile.year}`} />
              <InfoRow label="Time" value={`${timeLabel} · ${event.duration} min`} />
              {event.location ? <InfoRow label="Where" value={event.location} /> : null}
              <InfoRow label="Price" value={priceLabel} />
              {remaining !== null ? (
                <InfoRow
                  label="Availability"
                  value={
                    remaining === 0
                      ? soldOut
                        ? "Sold out"
                        : "Full · waitlist open"
                      : `${remaining} spots left`
                  }
                />
              ) : null}
            </dl>
          </aside>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
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

function formatTime(time: string) {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
