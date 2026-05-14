import { useMemo } from "react";
import type { EventDto } from "@workspace/contracts";
import { cn } from "@/lib/utils";
import { dateKey, eventsByDate, layoutDay, splitAllDay, type EventInstance } from "./event-utils";
import {
  AllDayPill,
  EventBlock,
  HOURS,
  HourDroppables,
  HourGridLines,
  NowIndicator,
  SLOT_PX,
  TimeGutter,
} from "./time-grid";

export interface WeekViewProps {
  currentDate: Date;
  selectedDate: string;
  events: EventDto[];
  canManage: boolean;
  onSelectDate: (dateKey: string) => void;
  onEventClick: (event: EventDto) => void;
  onSlotClick: (dateKey: string, time: string) => void;
  onResizeStart?: (instance: EventInstance, startY: number) => void;
  resizeOverride?: { instanceKey: string; minutes: number } | null;
}

function getWeekDays(date: Date): Date[] {
  const dayOfWeek = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - dayOfWeek);
  const days: Date[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

export function WeekView({
  currentDate,
  selectedDate,
  events,
  canManage,
  onSelectDate,
  onEventClick,
  onSlotClick,
  onResizeStart,
  resizeOverride,
}: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const byDate = useMemo(() => {
    const rangeStart = new Date(weekDays[0]);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(weekDays[6]);
    rangeEnd.setHours(23, 59, 59);
    return eventsByDate(events, rangeStart, rangeEnd);
  }, [events, weekDays]);

  const todayKey = dateKey(new Date());

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-30 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-card">
        <div />
        {weekDays.map((day) => {
          const key = dateKey(day);
          const isToday = todayKey === key;
          const isSelected = selectedDate === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelectDate(key)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 transition-colors",
                isSelected
                  ? "bg-primary/8 text-primary"
                  : isToday
                    ? "bg-primary/5"
                    : "hover:bg-muted/40",
              )}
            >
              <span className="text-3xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-semibold tabular-nums",
                  isToday && "bg-primary text-primary-foreground shadow-sm",
                  isSelected && !isToday && "text-primary",
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sticky top-[57px] z-20 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-card">
        <div className="px-2 py-1 text-right text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
          all-day
        </div>
        {weekDays.map((day) => {
          const key = dateKey(day);
          const dayEvents = byDate.get(key) ?? [];
          const { allDay } = splitAllDay(dayEvents);
          return (
            <div
              key={key}
              className="flex flex-col gap-0.5 border-l border-border/60 px-1 py-1 min-h-[24px]"
            >
              {allDay.map((instance) => (
                <AllDayPill
                  key={instance.instanceKey}
                  instance={instance}
                  canManage={canManage}
                  onClick={onEventClick}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex">
        <TimeGutter />
        <div className="grid flex-1 grid-cols-7" style={{ height: HOURS.length * SLOT_PX }}>
          {weekDays.map((day) => {
            const key = dateKey(day);
            const isToday = todayKey === key;
            const dayEvents = byDate.get(key) ?? [];
            const { timed } = splitAllDay(dayEvents);
            const laidOut = layoutDay(timed);
            return (
              <div
                key={key}
                className={cn("relative border-l border-border/60", isToday && "bg-primary/[0.03]")}
              >
                <HourGridLines />
                <HourDroppables dateKey={key} canManage={canManage} onSlotClick={onSlotClick} />
                {laidOut.map(({ instance, column, columnCount }) => (
                  <EventBlock
                    key={instance.instanceKey}
                    instance={instance}
                    column={column}
                    columnCount={columnCount}
                    canManage={canManage}
                    onClick={onEventClick}
                    onResizeStart={onResizeStart}
                    resizeOverrideMinutes={
                      resizeOverride?.instanceKey === instance.instanceKey
                        ? resizeOverride.minutes
                        : undefined
                    }
                  />
                ))}
                <NowIndicator visible={isToday} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
