import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Repeat } from "lucide-react";
import { useMemo } from "react";
import type { EventDto } from "@workspace/contracts";
import { cn } from "@/lib/utils";
import {
  dateKey,
  eventsByDate,
  getEventColorStyle,
  getEventTone,
  shortTime,
  useCategoryConfigs,
  type EventInstance,
} from "./event-utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 2;

export interface MonthViewProps {
  currentDate: Date;
  selectedDate: string;
  events: EventDto[];
  canManage: boolean;
  onSelectDate: (dateKey: string) => void;
  onEventClick: (event: EventDto) => void;
}

export function MonthView({
  currentDate,
  selectedDate,
  events,
  canManage,
  onSelectDate,
  onEventClick,
}: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const byDate = useMemo(() => {
    const rangeStart = new Date(year, month, 1);
    const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59);
    return eventsByDate(events, rangeStart, rangeEnd);
  }, [events, year, month]);

  const todayKey = dateKey(new Date());
  const totalCells = startingDayOfWeek + daysInMonth;
  const totalRows = Math.ceil(totalCells / 7);
  const trailingEmpty = totalRows * 7 - totalCells;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startingDayOfWeek; i += 1) {
    cells.push(<EmptyCell key={`pre-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = byDate.get(key) ?? [];
    cells.push(
      <DayCell
        key={key}
        dateKey={key}
        dayNumber={day}
        events={dayEvents}
        isToday={todayKey === key}
        isSelected={selectedDate === key}
        canManage={canManage}
        onSelect={onSelectDate}
        onEventClick={onEventClick}
      />,
    );
  }
  for (let i = 0; i < trailingEmpty; i += 1) {
    cells.push(<EmptyCell key={`post-${i}`} />);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b bg-muted/40 px-1.5">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-1.5 text-center text-3xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>
      <div
        className="grid flex-1 grid-cols-7 gap-px bg-border p-px"
        style={{ gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))` }}
      >
        {cells}
      </div>
    </div>
  );
}

function EmptyCell() {
  return <div className="bg-muted/20" />;
}

interface DayCellProps {
  dateKey: string;
  dayNumber: number;
  events: EventInstance[];
  isToday: boolean;
  isSelected: boolean;
  canManage: boolean;
  onSelect: (dateKey: string) => void;
  onEventClick: (event: EventDto) => void;
}

function DayCell({
  dateKey: key,
  dayNumber,
  events,
  isToday,
  isSelected,
  canManage,
  onSelect,
  onEventClick,
}: DayCellProps) {
  const { ref, isDropTarget } = useDroppable({
    id: `month-day:${key}`,
    type: "day",
    accept: "event",
    data: { dateKey: key },
  });

  return (
    <div
      ref={ref}
      onClick={() => onSelect(key)}
      className={cn(
        "group/cell flex min-h-0 cursor-pointer flex-col gap-1 px-1.5 py-1 transition-colors",
        isSelected ? "bg-primary/8 ring-1 ring-inset ring-primary/40" : "bg-card hover:bg-muted/40",
        isDropTarget && "ring-2 ring-inset ring-primary/60",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-2xs font-semibold tabular-nums",
            isToday
              ? "bg-primary text-primary-foreground shadow-sm"
              : isSelected
                ? "text-primary"
                : "text-foreground",
          )}
        >
          {dayNumber}
        </span>
        {events.length > 0 && (
          <span className="text-3xs font-medium text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover/cell:opacity-100">
            {events.length}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
        {events.slice(0, MAX_VISIBLE).map((instance) => (
          <MonthEventChip
            key={instance.instanceKey}
            instance={instance}
            canManage={canManage}
            onEventClick={onEventClick}
          />
        ))}
        {events.length > MAX_VISIBLE && (
          <div className="px-1 text-3xs font-medium text-muted-foreground">
            +{events.length - MAX_VISIBLE} more
          </div>
        )}
      </div>
    </div>
  );
}

interface MonthEventChipProps {
  instance: EventInstance;
  canManage: boolean;
  onEventClick: (event: EventDto) => void;
}

function MonthEventChip({ instance, canManage, onEventClick }: MonthEventChipProps) {
  const event = instance.event;
  const configs = useCategoryConfigs();
  const color = getEventColorStyle(event, configs);
  const tone = getEventTone(event);
  const { ref, isDragSource } = useDraggable({
    id: `event:${instance.instanceKey}`,
    type: "event",
    disabled: !canManage,
    data: { eventId: event.id },
  });

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event);
      }}
      className={cn(
        "flex items-center gap-1 rounded-sm bg-muted/60 px-1 py-0.5 text-3xs leading-tight transition-colors hover:bg-muted",
        tone.opacity,
        tone.italic && "italic",
        isDragSource && "opacity-50",
      )}
      title={`${event.title} at ${shortTime(event.time)}`}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", color.className)}
        style={color.style}
        aria-hidden
      />
      {!event.allDay && (
        <span className="font-medium tabular-nums text-muted-foreground">
          {shortTime(event.time)}
        </span>
      )}
      <span
        className={cn("truncate font-medium text-foreground", tone.lineThrough && "line-through")}
      >
        {event.title}
      </span>
      {event.recurring && <Repeat className="ml-auto size-2.5 shrink-0 text-muted-foreground" />}
    </div>
  );
}
