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

export interface DayViewProps {
  currentDate: Date;
  events: EventDto[];
  canManage: boolean;
  onEventClick: (event: EventDto) => void;
  onSlotClick: (dateKey: string, time: string) => void;
  onResizeStart?: (instance: EventInstance, startY: number) => void;
  resizeOverride?: { instanceKey: string; minutes: number } | null;
}

export function DayView({
  currentDate,
  events,
  canManage,
  onEventClick,
  onSlotClick,
  onResizeStart,
  resizeOverride,
}: DayViewProps) {
  const key = dateKey(currentDate);
  const todayKey = dateKey(new Date());
  const isToday = todayKey === key;

  const byDate = useMemo(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59);
    return eventsByDate(events, start, end);
  }, [events, currentDate]);

  const dayEvents = byDate.get(key) ?? [];
  const { allDay, timed } = splitAllDay(dayEvents);
  const laidOut = layoutDay(timed);

  return (
    <div>
      {allDay.length > 0 && (
        <div className="sticky top-0 z-20 flex items-center gap-1 border-b bg-card px-3 py-1.5">
          <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
            all-day
          </span>
          <div className="flex flex-1 flex-wrap gap-1">
            {allDay.map((instance) => (
              <AllDayPill
                key={instance.instanceKey}
                instance={instance}
                canManage={canManage}
                onClick={onEventClick}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex">
        <TimeGutter />
        <div
          className={cn(
            "relative flex-1 border-l border-border/60",
            isToday && "bg-primary/[0.03]",
          )}
          style={{ height: HOURS.length * SLOT_PX }}
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
      </div>
    </div>
  );
}
