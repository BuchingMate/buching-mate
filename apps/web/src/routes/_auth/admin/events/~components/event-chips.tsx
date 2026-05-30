import { Ban, CalendarClock, CheckCircle2, Globe, Lock, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const CHIP_TRIGGER = "h-7 w-auto gap-1.5 rounded-full px-3 text-xs font-medium";

export function VisibilityChip({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const published = value === "published";
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger className={CHIP_TRIGGER}>
        {published ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
        <span>{published ? "Public" : "Unpublished"}</span>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="w-auto min-w-56">
        <SelectItem value="unpublished">Unpublished — only your team</SelectItem>
        <SelectItem value="published">Public — on your booking page</SelectItem>
      </SelectContent>
    </Select>
  );
}

const STATUS_META: Record<string, { icon: typeof Ban; label: string }> = {
  upcoming: { icon: CalendarClock, label: "Upcoming" },
  completed: { icon: CheckCircle2, label: "Completed" },
  cancelled: { icon: Ban, label: "Cancelled" },
};

export function StatusChip({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const meta = STATUS_META[value] ?? STATUS_META.upcoming;
  const Icon = meta.icon;
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger className={CHIP_TRIGGER}>
        <Icon className="size-3.5" />
        <span>{meta.label}</span>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="w-auto min-w-40">
        <SelectItem value="upcoming">Upcoming</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="cancelled">Cancelled</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function CategoryChip({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const categories = value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-normal"
          >
            <Tag className="size-3.5 text-muted-foreground" />
            {categories.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1">
                {categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-secondary px-1.5 py-0.5 text-secondary-foreground"
                  >
                    {c}
                  </span>
                ))}
              </span>
            ) : (
              "Add category"
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-64 space-y-2 p-3">
        <Label htmlFor="event-category" className="text-xs">
          Categories
        </Label>
        <Input
          id="event-category"
          autoFocus
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="fitness, yoga"
          className="h-8"
        />
        <p className="text-xs text-muted-foreground">Separate multiple with commas.</p>
      </PopoverContent>
    </Popover>
  );
}
