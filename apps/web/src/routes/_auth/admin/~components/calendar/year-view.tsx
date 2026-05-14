import { useMemo } from "react";
import type { EventDto } from "@workspace/contracts";
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

export interface YearViewProps {
  currentDate: Date;
  events: EventDto[];
  onSelectMonth: (date: Date) => void;
}

export function YearView({ currentDate, events, onSelectMonth }: YearViewProps) {
  const year = currentDate.getFullYear();

  const byDate = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    return eventsByDate(events, start, end);
  }, [events, year]);

  const monthsTotal = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => 0);
    byDate.forEach((bucket, key) => {
      const monthIndex = Number(key.slice(5, 7)) - 1;
      totals[monthIndex] += bucket.length;
    });
    return totals;
  }, [byDate]);

  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, idx) => (
        <MiniMonth
          key={idx}
          year={year}
          monthIndex={idx}
          totalEvents={monthsTotal[idx]}
          byDate={byDate}
          onSelectMonth={onSelectMonth}
        />
      ))}
    </div>
  );
}

interface MiniMonthProps {
  year: number;
  monthIndex: number;
  totalEvents: number;
  byDate: Map<string, unknown[]>;
  onSelectMonth: (date: Date) => void;
}

function MiniMonth({ year, monthIndex, totalEvents, byDate, onSelectMonth }: MiniMonthProps) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push(<div key={`empty-${i}`} className="aspect-square" />);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasEvents = (byDate.get(key) ?? []).length > 0;
    cells.push(
      <div
        key={day}
        className={cn(
          "flex aspect-square items-center justify-center rounded-sm text-3xs tabular-nums",
          hasEvents
            ? "bg-primary/90 font-semibold text-primary-foreground"
            : "text-muted-foreground/70",
        )}
      >
        {day}
      </div>,
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectMonth(new Date(year, monthIndex, 1))}
      className="rounded-lg border bg-card p-3 text-left transition-shadow hover:shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide">{MONTH_NAMES[monthIndex]}</h4>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-3xs font-medium tabular-nums text-muted-foreground">
          {totalEvents}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5">{cells}</div>
    </button>
  );
}
