import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Plus, Repeat, Search, X } from "lucide-react";
import type { ResourceDto, ResourceType } from "@workspace/contracts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventFormState } from "@/lib/events";

export type ResourceAssignmentDraft = { resourceId: string; role: string; quantity: number };

const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
] as const;

const WEEKDAYS = [
  { value: "monday", label: "Mo" },
  { value: "tuesday", label: "Tu" },
  { value: "wednesday", label: "We" },
  { value: "thursday", label: "Th" },
  { value: "friday", label: "Fr" },
  { value: "saturday", label: "Sa" },
  { value: "sunday", label: "Su" },
] as const;

const INTERVAL_UNIT: Record<string, string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
};

export function ScheduleSection({
  form,
  onChange,
  disabled,
}: {
  form: EventFormState;
  onChange: (field: keyof EventFormState, value: string) => void;
  disabled?: boolean;
}) {
  // Collapse the legacy recurring(Yes/No) + frequency pair into one control.
  const repeat = form.recurring === "true" ? form.recurrenceFrequency || "weekly" : "none";
  const repeats = repeat !== "none";
  const showDays = repeat === "weekly" || repeat === "biweekly";
  const showInterval = repeats && repeat !== "biweekly";
  const selectedDays = new Set(
    form.recurrenceDays
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
  );

  const setRepeat = (value: string) => {
    if (value === "none") {
      onChange("recurring", "false");
      onChange("recurrenceFrequency", "");
      onChange("recurrenceInterval", "");
      onChange("recurrenceDays", "");
      onChange("recurrenceEndDate", "");
      return;
    }
    onChange("recurring", "true");
    onChange("recurrenceFrequency", value);
  };

  const toggleDay = (day: string) => {
    const next = new Set(selectedDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    // Keep stored order Mon..Sun regardless of click order.
    onChange(
      "recurrenceDays",
      WEEKDAYS.filter((d) => next.has(d.value))
        .map((d) => d.value)
        .join(", "),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Repeat className="size-3.5" /> Repeats
        </Label>
        <Select
          value={repeat}
          onValueChange={(value) => value && setRepeat(value)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-auto min-w-44 gap-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {REPEAT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showInterval && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">every</span>
            <Input
              type="number"
              min="1"
              className="h-8 w-16"
              placeholder="1"
              disabled={disabled}
              value={form.recurrenceInterval}
              onChange={(e) => onChange("recurrenceInterval", e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {INTERVAL_UNIT[repeat] ?? "times"}
            </span>
          </div>
        )}
      </div>

      {showDays && (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              disabled={disabled}
              aria-pressed={selectedDays.has(d.value)}
              className={cn(
                "h-8 w-8 rounded-full border text-xs font-medium transition-colors disabled:opacity-50",
                selectedDays.has(d.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {repeats && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Ends</span>
          <DatePicker
            id="create-recurrence-end"
            value={form.recurrenceEndDate}
            disabled={disabled}
            onChange={(value) => onChange("recurrenceEndDate", value)}
          />
          <span className="text-xs text-muted-foreground">leave empty to repeat forever</span>
        </div>
      )}
    </div>
  );
}

export function ImageFilePicker({
  file,
  disabled,
  emptyTitle,
  emptyDescription,
  onChange,
}: {
  file: File | null;
  disabled: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      {file ? (
        <FilePreview file={file}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute right-2 top-2"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </FilePreview>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-background px-4 py-8 text-center hover:bg-muted/30">
          <ImageIcon className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">{emptyTitle}</span>
          <span className="text-xs text-muted-foreground">{emptyDescription}</span>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={disabled}
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}

function FilePreview({ file, children }: { file: File; children: React.ReactNode }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-md border bg-background">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
      {children}
    </div>
  );
}

const resourceTypeFilters: { value: "all" | ResourceType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "instructor", label: "Instructor" },
  { value: "location", label: "Location" },
  { value: "equipment", label: "Equipment" },
  { value: "material", label: "Material" },
  { value: "custom", label: "Custom" },
];

export function ResourceAssignmentEditor({
  resources,
  assignments,
  onChange,
}: {
  resources: ResourceDto[];
  assignments: ResourceAssignmentDraft[];
  onChange: (assignments: ResourceAssignmentDraft[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ResourceType>("all");

  const available = useMemo(() => {
    const assignedIds = new Set(
      assignments.map((assignment) => assignment.resourceId).filter(Boolean),
    );
    const needle = search.trim().toLowerCase();
    return resources.filter((resource) => {
      if (resource.archivedAt) return false;
      if (assignedIds.has(resource.id)) return false;
      if (typeFilter !== "all" && resource.type !== typeFilter) return false;
      if (needle.length > 0 && !resource.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [resources, search, typeFilter, assignments]);

  const assignedDetails = assignments.map((assignment) => ({
    assignment,
    resource: resources.find((resource) => resource.id === assignment.resourceId) ?? null,
  }));

  const assignResource = (resource: ResourceDto) => {
    onChange([...assignments, { resourceId: resource.id, role: resource.type, quantity: 1 }]);
  };

  const updateQuantity = (index: number, value: string) => {
    const next = [...assignments];
    next[index] = { ...next[index], quantity: Number(value) || 1 };
    onChange(next);
  };

  const removeAssignment = (index: number) => {
    onChange(assignments.filter((_, i) => i !== index));
  };

  if (resources.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="font-medium">Resources</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No resources yet. Create resources from the Resources page, then assign them here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Left: search + filters + available table */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {resourceTypeFilters.map((filter) => {
            const active = typeFilter === filter.value;
            return (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={active ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setTypeFilter(filter.value)}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
        <div className="max-h-72 overflow-y-auto rounded-md border bg-background">
          {available.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No matching resources.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8">Name</TableHead>
                  <TableHead className="h-8 w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {available.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell className="py-2">
                      <div className="text-sm font-medium">{resource.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {resource.type}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => assignResource(resource)}
                      >
                        <Plus className="size-3" />
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Right: assigned table */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned ({assignments.length})
        </Label>
        {assignments.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            None assigned yet. Click <span className="font-medium">Add</span> on a resource.
          </div>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8">Name</TableHead>
                  <TableHead className="h-8 w-20">Qty</TableHead>
                  <TableHead className="h-8 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedDetails.map(({ assignment, resource }, index) => (
                  <TableRow key={index}>
                    <TableCell className="py-2">
                      <div className="text-sm font-medium">
                        {resource ? resource.name : "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {resource ? resource.type : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="number"
                        min="1"
                        value={assignment.quantity}
                        onChange={(e) => updateQuantity(index, e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => removeAssignment(index)}
                        aria-label="Remove resource"
                      >
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
