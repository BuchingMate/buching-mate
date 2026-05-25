import { useEffect, useRef, useState } from "react";
import { Check, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { timezoneOptions, type TimezoneOption } from "@/lib/public";
import type { EventFormState } from "@/lib/events";

// Start/End date-time rows + timezone picker, shared by the create and edit
// forms. Pass recurrence (or anything schedule-related) as children to render
// it inside the start/end card under a divider.
export function ScheduleFields({
  form,
  onChange,
  disabled,
  children,
}: {
  form: EventFormState;
  onChange: (field: keyof EventFormState, value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const endBeforeStart =
    Boolean(form.endDate && form.endTime && form.date && form.time) &&
    `${form.endDate}T${form.endTime}` < `${form.date}T${form.time}`;

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <ScheduleRow
          label="Start"
          marker="filled"
          date={form.date}
          time={form.time}
          disabled={disabled}
          onDate={(v) => onChange("date", v)}
          onTime={(v) => onChange("time", v)}
        />
        <ScheduleRow
          label="End"
          marker="hollow"
          date={form.endDate}
          time={form.endTime}
          disabled={disabled}
          onDate={(v) => onChange("endDate", v)}
          onTime={(v) => onChange("endTime", v)}
        />
        {endBeforeStart && <p className="text-xs text-destructive">End must be after the start.</p>}
        {children && <div className="border-t pt-3">{children}</div>}
      </div>
      <div className="space-y-1.5 rounded-xl border bg-card p-4">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="size-3.5" /> Timezone
        </Label>
        <TimezonePicker
          value={form.timezone}
          disabled={disabled}
          onChange={(tz) => onChange("timezone", tz)}
        />
      </div>
    </div>
  );
}

function ScheduleRow({
  label,
  marker,
  date,
  time,
  disabled,
  onDate,
  onTime,
}: {
  label: string;
  marker: "filled" | "hollow";
  date: string;
  time: string;
  disabled?: boolean;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex w-12 shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
        <span
          className={cn(
            "size-2 rounded-full",
            marker === "filled" ? "bg-foreground" : "border-2 border-muted-foreground",
          )}
        />
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <DatePicker value={date} onChange={onDate} disabled={disabled} />
      </div>
      <TimeField value={time} onChange={onTime} disabled={disabled} />
    </div>
  );
}

// 15-minute increments across the day: "00:00", "00:15", … "23:45".
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// Coerce loose input ("9", "9:5", "14:3") into "HH:MM"; leave unrecognized as-is
// so the form's validation can flag it.
function normalizeTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):?(\d{0,2})$/);
  if (!match) return value.trim();
  const h = Math.min(23, Number(match[1] || "0"));
  const m = Math.min(59, Number(match[2] || "0"));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TimeField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const needle = value.trim();
  // Narrow only while typing a partial; once it's a complete/known time, show
  // the full list (scrolled to current) so other times are browsable.
  const isComplete = TIME_OPTIONS.includes(needle);
  const matches = TIME_OPTIONS.filter((t) => t.startsWith(needle));
  const list = needle === "" || isComplete || matches.length === 0 ? TIME_OPTIONS : matches;

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div className="relative w-28 shrink-0">
      <Input
        ref={inputRef}
        value={value}
        disabled={disabled}
        placeholder="HH:MM"
        inputMode="numeric"
        autoComplete="off"
        className="pr-8"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            if (needle) onChange(normalizeTime(value));
          }, 150)
        }
      />
      <Clock className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {list.map((t) => {
            const current = t === value;
            return (
              <li key={t}>
                <button
                  type="button"
                  data-current={current}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    current && "bg-muted font-medium",
                  )}
                >
                  {t}
                  {current && <Check className="size-3.5 text-muted-foreground" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const TZ_OPTIONS = timezoneOptions();

function TimezonePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
}) {
  const selected = TZ_OPTIONS.find((o) => o.tz === value) ?? null;
  return (
    <Combobox<TimezoneOption>
      items={TZ_OPTIONS}
      value={selected}
      disabled={disabled}
      onValueChange={(option) => option && onChange(option.tz)}
      itemToStringLabel={(o) => `${o.region.split("/").pop()} (${o.offset})`}
      itemToStringValue={(o) => o.tz}
      isItemEqualToValue={(a, b) => a.tz === b.tz}
    >
      <ComboboxInput placeholder="Search timezone" className="text-sm" />
      <ComboboxContent>
        <ComboboxList>
          {(o: TimezoneOption) => (
            <ComboboxItem key={o.tz} value={o}>
              <div className="flex w-full items-center justify-between gap-3">
                <span className="truncate">{o.region.split("/").pop()}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {o.offset}
                </span>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>No timezone found.</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
