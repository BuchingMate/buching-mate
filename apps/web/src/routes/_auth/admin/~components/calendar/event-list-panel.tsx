import { Link } from "@tanstack/react-router";
import { Clock, Plus, Repeat, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { EventDto } from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  dateKey,
  endTimeString,
  getEventColorStyle,
  getEventTone,
  shortTime,
  useCategoryConfigs,
} from "./event-utils";

type SortType = "date" | "title";

export interface EventListPanelProps {
  events: EventDto[];
  selectedDate: string | null;
  onClearDate: () => void;
  canCreate?: boolean;
  onCreateClick?: () => void;
  scopedCount?: number;
  scopePrimary?: string;
  scopeSecondary?: string;
}

export function EventListPanel({
  events,
  selectedDate,
  onClearDate,
  canCreate,
  onCreateClick,
  scopedCount,
  scopePrimary,
  scopeSecondary,
}: EventListPanelProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortType>("date");

  const todayKey = dateKey(new Date());

  const categories = useMemo(() => {
    const set = new Set<string>();
    events.forEach((event) => {
      if (event.category) set.add(event.category);
    });
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let list = events;
    if (selectedDate) list = list.filter((event) => event.date === selectedDate);
    if (filterCategory !== "all") list = list.filter((event) => event.category === filterCategory);
    return [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
  }, [events, selectedDate, filterCategory, sortBy]);

  const todayEvents = useMemo(
    () => (selectedDate ? [] : filtered.filter((event) => event.date === todayKey)),
    [filtered, todayKey, selectedDate],
  );
  const upcomingEvents = useMemo(
    () => (selectedDate ? filtered : filtered.filter((event) => event.date > todayKey)),
    [filtered, todayKey, selectedDate],
  );
  const pastEvents = useMemo(
    () => (selectedDate ? [] : filtered.filter((event) => event.date < todayKey)),
    [filtered, todayKey, selectedDate],
  );

  const heading = selectedDate
    ? new Date(selectedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Schedule";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-end justify-between gap-3 border-b px-4 py-4">
        <div className="flex items-end gap-3">
          <span className="text-4xl font-semibold tabular-nums leading-none tracking-tight">
            {scopedCount ?? events.length}
          </span>
          <div className="flex flex-col pb-0.5">
            <span className="text-sm font-semibold tracking-tight leading-tight">
              {scopePrimary ?? (events.length === 1 ? "Event" : "Events")}
            </span>
            <span className="mt-0.5 text-xs font-medium tracking-tight leading-tight text-muted-foreground">
              {scopeSecondary ?? "total"}
            </span>
          </div>
        </div>
        {onCreateClick && (
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={onCreateClick}
            disabled={!canCreate}
          >
            <Plus className="size-3.5" />
            New event
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Select value={filterCategory} onValueChange={(v) => v && setFilterCategory(v)}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => v && setSortBy(v as SortType)}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}{" "}
          <span className="font-normal normal-case tracking-normal">({filtered.length})</span>
        </h3>
        {selectedDate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearDate}
            className="h-6 gap-1 px-1.5 text-2xs text-muted-foreground"
          >
            <X className="size-3" />
            Clear
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : selectedDate ? (
          <ItemList items={filtered} />
        ) : (
          <>
            {todayEvents.length > 0 && (
              <Section label="Today" tone="accent">
                <ItemList items={todayEvents} />
              </Section>
            )}
            {upcomingEvents.length > 0 && (
              <Section label="Upcoming">
                <ItemList items={upcomingEvents} />
              </Section>
            )}
            {pastEvents.length > 0 && (
              <Section label="Past" muted>
                <ItemList items={pastEvents} />
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  tone,
  muted,
  children,
}: {
  label: string;
  tone?: "accent";
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div
        className={cn(
          "flex items-center gap-2 pt-1.5 pb-1 text-3xs font-semibold uppercase tracking-[0.08em]",
          tone === "accent" ? "text-primary" : "text-muted-foreground",
          muted && "opacity-70",
        )}
      >
        {tone === "accent" && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
        {label}
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <p className="text-xs font-medium">No events</p>
      <p className="text-2xs text-muted-foreground">
        Adjust filters, or open the New tab to add one.
      </p>
    </div>
  );
}

function ItemList({ items }: { items: EventDto[] }) {
  return (
    <ul className="space-y-1">
      {items.map((event) => (
        <li key={event.id}>
          <EventRow event={event} />
        </li>
      ))}
    </ul>
  );
}

function EventRow({ event }: { event: EventDto }) {
  const configs = useCategoryConfigs();
  const dot = getEventColorStyle(event, configs);
  const tone = getEventTone(event);
  return (
    <Link
      to="/admin/events/$eventId/edit"
      params={{ eventId: event.id }}
      className={cn(
        "group block rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60",
        tone.opacity,
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot.className)}
          style={dot.style}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "truncate text-sm font-medium tracking-tight",
                tone.lineThrough && "line-through",
              )}
            >
              {event.title}
            </p>
            {event.recurring && <Repeat className="size-3 shrink-0 text-muted-foreground" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Clock className="size-3" />
            <span>
              {shortTime(event.time)} – {endTimeString(event)}
            </span>
            <span aria-hidden>·</span>
            <span className="truncate">
              {new Date(event.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
            {event.category && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{event.category}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
