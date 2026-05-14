import type { CategoryConfigs, EventDto } from "@workspace/contracts";
import { addMinutes, format, parse } from "date-fns";
import { createContext, useContext } from "react";

const CategoryConfigsContext = createContext<CategoryConfigs>({});
export const CategoryConfigsProvider = CategoryConfigsContext.Provider;
export function useCategoryConfigs(): CategoryConfigs {
  return useContext(CategoryConfigsContext);
}

const TAG_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
];

function hashColorClass(seed: string | null | undefined): string {
  if (!seed) return "bg-gray-500";
  const hash = seed.split("").reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  return TAG_COLORS[hash % TAG_COLORS.length];
}

type ColorEvent = {
  tags: string[];
  category: string | null;
  status: "upcoming" | "completed" | "cancelled";
  visibility: "published" | "unpublished";
};

export function getEventColorStyle(
  event: ColorEvent,
  configs?: CategoryConfigs,
): { className?: string; style?: { backgroundColor: string } } {
  if (event.status === "cancelled") return { className: "bg-destructive" };
  if (event.status === "completed") return { className: "bg-muted-foreground/60" };
  const configured = event.category ? configs?.[event.category]?.color : undefined;
  if (configured) return { style: { backgroundColor: configured } };
  const seed = event.tags[0] ?? event.category;
  if (seed) return { className: hashColorClass(seed) };
  if (event.visibility === "published") return { className: "bg-success" };
  return { className: "bg-muted-foreground/40" };
}

export interface EventTone {
  opacity?: string;
  lineThrough: boolean;
  italic: boolean;
}

export function getEventTone(event: ColorEvent): EventTone {
  if (event.status === "cancelled")
    return { lineThrough: true, italic: false, opacity: "opacity-60" };
  if (event.status === "completed")
    return { lineThrough: false, italic: false, opacity: "opacity-70" };
  if (event.visibility === "unpublished") return { lineThrough: false, italic: true };
  return { lineThrough: false, italic: false };
}

export function shortTime(time: string): string {
  return time.slice(0, 5);
}

export function eventStartDate(event: EventDto): Date {
  return parse(`${event.date} ${shortTime(event.time)}`, "yyyy-MM-dd HH:mm", new Date());
}

export function eventEndDate(event: EventDto): Date {
  return addMinutes(eventStartDate(event), event.duration);
}

export function endTimeString(event: EventDto): string {
  return format(eventEndDate(event), "HH:mm");
}

export function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function frequencyStep(
  frequency: string,
): { kind: "day" | "month" | "year"; amount: number } | null {
  switch (frequency) {
    case "daily":
      return { kind: "day", amount: 1 };
    case "weekly":
      return { kind: "day", amount: 7 };
    case "biweekly":
      return { kind: "day", amount: 14 };
    case "monthly":
      return { kind: "month", amount: 1 };
    case "yearly":
      return { kind: "year", amount: 1 };
    default:
      return null;
  }
}

function advance(current: Date, frequency: string, interval: number): Date {
  const step = frequencyStep(frequency);
  if (!step) return current;
  const next = new Date(current);
  const amount = step.amount * interval;
  if (step.kind === "day") next.setDate(next.getDate() + amount);
  else if (step.kind === "month") next.setMonth(next.getMonth() + amount);
  else next.setFullYear(next.getFullYear() + amount);
  return next;
}

interface EventInstance {
  event: EventDto;
  start: Date;
  end: Date;
  instanceKey: string;
}

export function expandEvent(event: EventDto, rangeStart: Date, rangeEnd: Date): EventInstance[] {
  const baseStart = eventStartDate(event);
  if (!event.recurring || !event.recurrenceFrequency) {
    if (baseStart > rangeEnd) return [];
    if (eventEndDate(event) < rangeStart) return [];
    return [
      {
        event,
        start: baseStart,
        end: eventEndDate(event),
        instanceKey: event.id,
      },
    ];
  }

  const interval =
    event.recurrenceInterval && event.recurrenceInterval > 0 ? event.recurrenceInterval : 1;
  const limit = event.recurrenceEndDate
    ? parse(event.recurrenceEndDate, "yyyy-MM-dd", new Date())
    : rangeEnd;
  const cap = limit < rangeEnd ? limit : rangeEnd;

  const instances: EventInstance[] = [];
  let cursor = baseStart;
  let safety = 0;
  while (cursor <= cap && safety < 800) {
    if (cursor >= rangeStart) {
      const start = cursor;
      const end = addMinutes(start, event.duration);
      const key = `${event.id}-${dateKey(start)}`;
      instances.push({ event, start, end, instanceKey: key });
    }
    cursor = advance(cursor, event.recurrenceFrequency, interval);
    safety += 1;
  }
  return instances;
}

export function eventsByDate(
  events: EventDto[],
  rangeStart: Date,
  rangeEnd: Date,
): Map<string, EventInstance[]> {
  const map = new Map<string, EventInstance[]>();
  for (const event of events) {
    const instances = expandEvent(event, rangeStart, rangeEnd);
    for (const instance of instances) {
      const key = dateKey(instance.start);
      const bucket = map.get(key);
      if (bucket) bucket.push(instance);
      else map.set(key, [instance]);
    }
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  return map;
}

export function splitAllDay(instances: EventInstance[]): {
  allDay: EventInstance[];
  timed: EventInstance[];
} {
  const allDay: EventInstance[] = [];
  const timed: EventInstance[] = [];
  for (const instance of instances) {
    if (instance.event.allDay) allDay.push(instance);
    else timed.push(instance);
  }
  return { allDay, timed };
}

export interface LaidOutInstance {
  instance: EventInstance;
  column: number;
  columnCount: number;
}

// Sweep-line column assignment for overlapping events on a single day.
// Each event gets a column index and a group-wide columnCount so callers
// can render side-by-side using `left = column / columnCount`.
export function layoutDay(instances: EventInstance[]): LaidOutInstance[] {
  if (instances.length === 0) return [];

  const sorted = [...instances].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) return startDiff;
    return b.end.getTime() - a.end.getTime();
  });

  const result: LaidOutInstance[] = [];
  let group: { laid: LaidOutInstance[]; groupEnd: number } = { laid: [], groupEnd: 0 };

  const flushGroup = () => {
    if (group.laid.length === 0) return;
    const columnCount = group.laid.reduce((max, item) => Math.max(max, item.column + 1), 1);
    for (const item of group.laid) {
      result.push({ ...item, columnCount });
    }
    group = { laid: [], groupEnd: 0 };
  };

  for (const instance of sorted) {
    const startMs = instance.start.getTime();
    const endMs = instance.end.getTime();

    if (group.laid.length > 0 && startMs >= group.groupEnd) {
      flushGroup();
    }

    const usedColumns = new Set(
      group.laid.filter((item) => item.instance.end.getTime() > startMs).map((item) => item.column),
    );
    let column = 0;
    while (usedColumns.has(column)) column += 1;

    group.laid.push({ instance, column, columnCount: 0 });
    group.groupEnd = Math.max(group.groupEnd, endMs);
  }
  flushGroup();

  return result;
}

export type { EventInstance };
