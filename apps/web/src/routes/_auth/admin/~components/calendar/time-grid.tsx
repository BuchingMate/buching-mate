import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import type { EventDto } from "@workspace/contracts";
import { cn } from "@/lib/utils";
import {
  endTimeString,
  getEventColorStyle,
  getEventTone,
  shortTime,
  useCategoryConfigs,
  type EventInstance,
} from "./event-utils";

export const SLOT_PX = 48;
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export function TimeGutter() {
  return (
    <div className="relative shrink-0" style={{ width: 56, height: HOURS.length * SLOT_PX }}>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute right-0 -translate-y-1/2 pr-2 text-right text-3xs font-medium tabular-nums text-muted-foreground"
          style={{ top: hour * SLOT_PX }}
        >
          {hour === 0 ? "" : formatHour(hour)}
        </div>
      ))}
    </div>
  );
}

export function HourGridLines() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-border/60"
          style={{ top: hour * SLOT_PX }}
        />
      ))}
    </div>
  );
}

interface HourDroppablesProps {
  dateKey: string;
  canManage: boolean;
  onSlotClick: (dateKey: string, time: string) => void;
}

export function HourDroppables({ dateKey, canManage, onSlotClick }: HourDroppablesProps) {
  return (
    <div className="absolute inset-0 z-0">
      {HOURS.map((hour) => (
        <HourDropZone
          key={hour}
          dateKey={dateKey}
          hour={hour}
          canManage={canManage}
          onSlotClick={onSlotClick}
        />
      ))}
    </div>
  );
}

function HourDropZone({
  dateKey,
  hour,
  canManage,
  onSlotClick,
}: {
  dateKey: string;
  hour: number;
  canManage: boolean;
  onSlotClick: (dateKey: string, time: string) => void;
}) {
  const time = `${String(hour).padStart(2, "0")}:00`;
  const { ref, isDropTarget } = useDroppable({
    id: `slot:${dateKey}:${time}`,
    type: "slot",
    accept: "event",
    data: { dateKey, time },
  });

  return (
    <div
      ref={ref}
      onClick={() => canManage && onSlotClick(dateKey, time)}
      className={cn(
        "absolute left-0 right-0 transition-colors",
        canManage && "cursor-pointer hover:bg-primary/5",
        isDropTarget && "bg-primary/10 ring-1 ring-inset ring-primary/40",
      )}
      style={{ top: hour * SLOT_PX, height: SLOT_PX }}
    />
  );
}

interface NowIndicatorProps {
  visible: boolean;
}

export function NowIndicator({ visible }: NowIndicatorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!visible) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 60) * SLOT_PX;

  return (
    <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top }}>
      <div className="absolute -left-1 -top-1.5 size-3 rounded-full bg-primary shadow" />
      <div className="h-px bg-primary" />
    </div>
  );
}

interface AllDayPillProps {
  instance: EventInstance;
  canManage: boolean;
  onClick: (event: EventDto) => void;
}

export function AllDayPill({ instance, canManage, onClick }: AllDayPillProps) {
  const event = instance.event;
  const configs = useCategoryConfigs();
  const { ref, isDragSource } = useDraggable({
    id: `event:${instance.instanceKey}`,
    type: "event",
    disabled: !canManage,
    data: { eventId: event.id },
  });
  const color = getEventColorStyle(event, configs);
  const tone = getEventTone(event);

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      className={cn(
        "flex cursor-pointer items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-3xs font-medium ring-1 ring-border/70 transition-shadow hover:shadow-sm",
        tone.opacity,
        tone.italic && "italic",
        isDragSource && "opacity-40",
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", color.className)}
        style={color.style}
        aria-hidden
      />
      <span className={cn("truncate text-foreground", tone.lineThrough && "line-through")}>
        {event.title}
      </span>
    </div>
  );
}

interface EventBlockProps {
  instance: EventInstance;
  column: number;
  columnCount: number;
  canManage: boolean;
  onClick: (event: EventDto) => void;
  onResizeStart?: (instance: EventInstance, startY: number) => void;
  resizeOverrideMinutes?: number;
}

export function EventBlock({
  instance,
  column,
  columnCount,
  canManage,
  onClick,
  onResizeStart,
  resizeOverrideMinutes,
}: EventBlockProps) {
  const event = instance.event;
  const configs = useCategoryConfigs();
  const { ref, isDragSource } = useDraggable({
    id: `event:${instance.instanceKey}`,
    type: "event",
    disabled: !canManage,
    data: { eventId: event.id },
  });

  const startMinutes = instance.start.getHours() * 60 + instance.start.getMinutes();
  const durationMinutes = resizeOverrideMinutes ?? event.duration;
  const top = (startMinutes / 60) * SLOT_PX;
  const height = Math.max(18, (durationMinutes / 60) * SLOT_PX) - 2;
  const widthPct = 100 / columnCount;
  const leftPct = column * widthPct;
  const color = getEventColorStyle(event, configs);
  const tone = getEventTone(event);
  const isShort = durationMinutes < 45;

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      className={cn(
        "group absolute z-10 flex cursor-pointer overflow-hidden rounded-md bg-card text-2xs leading-tight ring-1 ring-border/70 transition-shadow hover:shadow-md",
        tone.opacity,
        tone.italic && "italic",
        isDragSource && "opacity-40",
      )}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
      }}
    >
      <span className={cn("w-1 shrink-0", color.className)} style={color.style} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col px-1.5 py-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "truncate font-semibold text-foreground",
              tone.lineThrough && "line-through",
            )}
          >
            {event.title}
          </span>
          {event.recurring && (
            <Repeat className="ml-auto size-2.5 shrink-0 text-muted-foreground" />
          )}
        </div>
        {!isShort && (
          <div className="mt-0.5 truncate text-3xs tabular-nums text-muted-foreground">
            {shortTime(event.time)} – {endTimeString(event)}
          </div>
        )}
      </div>
      {canManage && onResizeStart && (
        <ResizeHandle instance={instance} onResizeStart={onResizeStart} />
      )}
    </div>
  );
}

function ResizeHandle({
  instance,
  onResizeStart,
}: {
  instance: EventInstance;
  onResizeStart: (instance: EventInstance, startY: number) => void;
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onResizeStart(instance, e.clientY);
      }}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
      style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.08))" }}
    />
  );
}
