import { useMemo } from "react";
import type { EventDto } from "@workspace/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { eventsByDate } from "./event-utils";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface HeatMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventDto[];
}

export function HeatMapDialog({ open, onOpenChange, events }: HeatMapDialogProps) {
  const year = new Date().getFullYear();

  const counts = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    const map = eventsByDate(events, start, end);
    const result = new Map<string, number>();
    map.forEach((bucket, key) => result.set(key, bucket.length));
    return result;
  }, [events, year]);

  const maxCount = Math.max(1, ...counts.values());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Year heat map · {year}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Legend />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 12 }, (_, idx) => (
              <MonthHeatMap
                key={idx}
                year={year}
                monthIndex={idx}
                counts={counts}
                maxCount={maxCount}
              />
            ))}
          </div>
          <div className="pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>Total events: {events.length}</span>
            <span>
              Busiest day: {maxCount} event{maxCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Less</span>
      <div className="flex gap-1">
        <div className="size-4 rounded-sm bg-muted" />
        <div className="size-4 rounded-sm bg-success/25" />
        <div className="size-4 rounded-sm bg-success/50" />
        <div className="size-4 rounded-sm bg-success/75" />
        <div className="size-4 rounded-sm bg-success" />
      </div>
      <span className="text-sm text-muted-foreground">More</span>
    </div>
  );
}

interface MonthHeatMapProps {
  year: number;
  monthIndex: number;
  counts: Map<string, number>;
  maxCount: number;
}

function MonthHeatMap({ year, monthIndex, counts, maxCount }: MonthHeatMapProps) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{MONTH_NAMES[monthIndex]}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: daysInMonth }, (_, dayIdx) => {
          const day = dayIdx + 1;
          const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = counts.get(key) ?? 0;
          return (
            <div
              key={day}
              className={cn(
                "size-3 rounded-sm transition-transform hover:scale-125",
                intensityClass(count, maxCount),
              )}
              title={`${MONTH_NAMES[monthIndex]} ${day}: ${count} event${count !== 1 ? "s" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function intensityClass(count: number, maxCount: number): string {
  if (count === 0) return "bg-muted";
  const intensity = count / maxCount;
  if (intensity > 0.75) return "bg-success";
  if (intensity > 0.5) return "bg-success/75";
  if (intensity > 0.25) return "bg-success/50";
  return "bg-success/25";
}
