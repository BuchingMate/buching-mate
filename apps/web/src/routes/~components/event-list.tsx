import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { EventDto } from "@workspace/contracts";
import { formatPrice } from "@/lib/public";

export interface EventListEntry {
  event: EventDto;
  currency: string;
  orgName?: string;
}

// Luma-style date-grouped event list: a date rail on the left, event rows on
// the right. Shared by the global feed and org pages so every public surface
// reads the same way.
export function DateGroupedEventList({ entries }: { entries: EventListEntry[] }) {
  const groups = groupByDate(entries);

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <section key={group.date} className="grid gap-2 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
          <div className="pt-5 sm:text-right">
            <div className="text-sm font-semibold text-foreground">{group.dayLabel}</div>
            <div className="text-sm text-muted-foreground">{group.weekday}</div>
          </div>
          <div className="relative space-y-3 pb-8 pt-3 sm:border-l sm:border-dashed sm:border-border sm:pl-6">
            <span
              aria-hidden
              className="absolute -left-[5px] top-5 hidden size-[9px] rounded-full border-2 border-background bg-muted-foreground/50 sm:block"
            />
            {group.entries.map((entry) => (
              <EventRow key={entry.event.id} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventRow({ entry }: { entry: EventListEntry }) {
  const { event, currency, orgName } = entry;
  const remaining =
    event.maxCapacity === null
      ? null
      : Math.max(0, event.maxCapacity - event.confirmedRegistrations);
  const full = remaining !== null && remaining === 0;
  const low = remaining !== null && remaining > 0 && remaining <= 5;
  const priceLabel = event.price > 0 ? formatPrice(event.price, currency) : "Free";

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="group flex items-stretch justify-between gap-5 rounded-xl border border-border bg-card p-4 transition-all duration-200 ease-out hover:border-foreground/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="text-sm text-muted-foreground">
          {formatTime(event.time)}
          {orgName ? (
            <>
              <span className="mx-1.5 text-border">·</span>
              <span className="text-muted-foreground">{orgName}</span>
            </>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground line-clamp-2">
          {event.title}
        </h3>
        {event.location ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          <span
            className={
              event.price > 0
                ? "inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-semibold text-foreground"
                : "inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground"
            }
          >
            {priceLabel}
          </span>
          {full ? (
            <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
              {event.waitlistEnabled ? "Waitlist" : "Sold out"}
            </span>
          ) : low ? (
            <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
              Only {remaining} left
            </span>
          ) : null}
          {event.category ? (
            <span className="text-xs font-medium text-muted-foreground">{event.category}</span>
          ) : null}
        </div>
      </div>

      <div className="hidden size-[6.5rem] shrink-0 overflow-hidden rounded-lg bg-primary/10 sm:block">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-heading text-3xl font-semibold text-primary/45">
            {initialOf(event.title)}
          </div>
        )}
      </div>
    </Link>
  );
}

function initialOf(title: string) {
  return (title.trim()[0] ?? "•").toUpperCase();
}

interface DateGroup {
  date: string;
  dayLabel: string;
  weekday: string;
  entries: EventListEntry[];
}

function groupByDate(entries: EventListEntry[]): DateGroup[] {
  const map = new Map<string, EventListEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.event.date) ?? [];
    list.push(entry);
    map.set(entry.event.date, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, grouped]) => {
      const d = new Date(`${date}T00:00:00`);
      const valid = !Number.isNaN(d.getTime());
      return {
        date,
        dayLabel: valid ? relativeDayLabel(d) : date,
        weekday: valid ? d.toLocaleDateString(undefined, { weekday: "long" }) : "",
        entries: grouped.sort((a, b) => a.event.time.localeCompare(b.event.time)),
      };
    });
}

function relativeDayLabel(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTime(time: string) {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
