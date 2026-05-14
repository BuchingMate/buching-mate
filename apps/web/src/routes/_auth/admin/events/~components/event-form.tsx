import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ImageIcon, Plus, Search, Upload, X } from "lucide-react";
import type { EventStatus, EventVisibility, ResourceDto, ResourceType } from "@workspace/contracts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Textarea } from "@/components/ui/textarea";
import type { EventFormState } from "@/lib/events";

type ResourceAssignmentDraft = { resourceId: string; role: string; quantity: number };

const statuses: EventStatus[] = ["upcoming", "completed", "cancelled"];
const visibilities: EventVisibility[] = ["unpublished", "published"];

type StepKey = "basics" | "images" | "details" | "schedule" | "resources";

const steps: { key: StepKey; label: string; optional?: boolean }[] = [
  { key: "basics", label: "Basics" },
  { key: "images", label: "Images", optional: true },
  { key: "details", label: "Details" },
  { key: "resources", label: "Resources", optional: true },
  { key: "schedule", label: "Schedule", optional: true },
];

type EventFormProps = {
  form: EventFormState;
  onChange: (field: keyof EventFormState, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  submitLabel: string;
  disabled: boolean;
  resources: ResourceDto[];
  resourceAssignments: ResourceAssignmentDraft[];
  onResourceAssignmentsChange: (assignments: ResourceAssignmentDraft[]) => void;
  coverFile: File | null;
  detailFiles: File[];
  onCoverFileChange: (file: File | null) => void;
  onDetailFilesChange: (files: File[]) => void;
};

export function EventForm(props: EventFormProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex].key;
  const isLast = stepIndex === steps.length - 1;
  const canProceed = isStepValid(currentStep, props.form);

  const goNext = () => {
    if (!canProceed) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isLast) {
      goNext();
      return;
    }
    props.onSubmit(event);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <StepIndicator stepIndex={stepIndex} onJump={setStepIndex} />

      <div className="min-h-[260px]">
        {currentStep === "basics" && <BasicsSection {...props} />}
        {currentStep === "images" && <ImagesSection {...props} />}
        {currentStep === "details" && <DetailsSection {...props} />}
        {currentStep === "schedule" && <ScheduleSection {...props} />}
        {currentStep === "resources" && <ResourcesSection {...props} />}
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goBack}
          disabled={stepIndex === 0 || props.disabled}
        >
          Back
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </span>
          {isLast ? (
            <Button type="submit" disabled={props.disabled || !canProceed}>
              {props.submitLabel}
            </Button>
          ) : (
            <Button type="submit" disabled={!canProceed || props.disabled}>
              Next
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function isStepValid(step: StepKey, form: EventFormState) {
  if (step === "basics") {
    return (
      form.title.trim().length > 0 &&
      form.date.length > 0 &&
      form.time.length > 0 &&
      /^\d+$/.test(form.duration)
    );
  }
  if (step === "details") {
    if (form.isFree === "true") return true;
    return /^\d+(\.\d{1,2})?$/.test(form.price);
  }
  return true;
}

function StepIndicator({
  stepIndex,
  onJump,
}: {
  stepIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, i) => {
        const done = i < stepIndex;
        const current = i === stepIndex;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(i)}
              className="flex items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-current={current ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs font-medium tabular-nums",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary text-primary",
                  !done && !current && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-xs",
                  current ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
                {step.optional && (
                  <span className="ml-1 text-3xs text-muted-foreground/70">(Optional)</span>
                )}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function BasicsSection({ form, onChange }: EventFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="create-title">Title</Label>
        <Input
          id="create-title"
          value={form.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Yoga class, team workshop, etc."
          required
          autoFocus
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-date">Date</Label>
          <DatePicker
            id="create-date"
            value={form.date}
            onChange={(value) => onChange("date", value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-time">Time</Label>
          <Input
            id="create-time"
            type="time"
            value={form.time}
            onChange={(e) => onChange("time", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-duration">Duration</Label>
          <Input
            id="create-duration"
            type="number"
            min="1"
            value={form.duration}
            onChange={(e) => onChange("duration", e.target.value)}
            placeholder="60 min"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-capacity">Capacity</Label>
          <Input
            id="create-capacity"
            type="number"
            min="1"
            value={form.maxCapacity}
            onChange={(e) => onChange("maxCapacity", e.target.value)}
            placeholder="20 attendees"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-location">Location</Label>
        <Input
          id="create-location"
          value={form.location}
          onChange={(e) => onChange("location", e.target.value)}
          placeholder="Studio A or Zoom link"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select
            value={form.visibility}
            onValueChange={(value) => onChange("visibility", value as EventVisibility)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {visibilities.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(value) => onChange("status", value as EventStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function ImagesSection({
  coverFile,
  detailFiles,
  onCoverFileChange,
  onDetailFilesChange,
  disabled,
}: EventFormProps) {
  const addDetailFiles = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    onDetailFilesChange([...detailFiles, ...imageFiles]);
  };

  const removeDetailFile = (index: number) => {
    onDetailFilesChange(detailFiles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Cover image</Label>
        <p className="text-sm text-muted-foreground">
          Shown on event cards and at the top of the event page.
        </p>
        <ImageFilePicker
          file={coverFile}
          disabled={disabled}
          emptyTitle="Choose a cover image"
          emptyDescription="This is the main image people see before opening the event."
          onChange={onCoverFileChange}
        />
      </div>

      <div className="space-y-2">
        <Label>Event detail images</Label>
        <p className="text-sm text-muted-foreground">Shown in the event page gallery.</p>
        <div className="rounded-lg border bg-muted/20 p-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-background px-4 py-6 text-center hover:bg-muted/30">
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Add detail images</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WebP, or GIF.</span>
            <Input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={disabled}
              onChange={(event) => {
                addDetailFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>

          {detailFiles.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {detailFiles.map((file, index) => (
                <FilePreview key={`${file.name}-${file.lastModified}-${index}`} file={file}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute right-2 top-2 rounded-full"
                    disabled={disabled}
                    onClick={() => removeDetailFile(index)}
                    aria-label="Remove detail image"
                  >
                    <X className="size-4" />
                  </Button>
                </FilePreview>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ImageFilePicker({
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

function DetailsSection({ form, onChange }: EventFormProps) {
  const [extrasOpen, setExtrasOpen] = useState(false);
  const isFree = form.isFree === "true";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="create-description">Description</Label>
        <Textarea
          id="create-description"
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
          className="min-h-24"
          placeholder="Public-facing copy."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="create-price">Price</Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={isFree}
                onCheckedChange={(checked) => onChange("isFree", checked ? "true" : "false")}
              />
              Free
            </label>
          </div>
          <div className="relative">
            <Input
              id="create-price"
              value={isFree ? "" : form.price}
              onChange={(e) => onChange("price", e.target.value)}
              disabled={isFree}
              placeholder={isFree ? "Free" : "0.00"}
              className="pr-14"
            />
            {!isFree && (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                USD
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-category">Category</Label>
          <Input
            id="create-category"
            value={form.category}
            onChange={(e) => onChange("category", e.target.value)}
            placeholder="fitness, workshop"
          />
        </div>
      </div>

      <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              <span>Tags & internal notes</span>
              <ChevronDown
                className={cn("size-4 transition-transform", extrasOpen && "rotate-180")}
              />
            </button>
          }
        />
        <CollapsibleContent className="pt-3">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-tags">Tags</Label>
              <Input
                id="create-tags"
                value={form.tags}
                onChange={(e) => onChange("tags", e.target.value)}
                placeholder="urgent, vip, sponsor (comma separated)"
              />
              <p className="text-xs text-muted-foreground">
                Free-form labels for filtering and color hints.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-notes">Internal notes</Label>
              <Textarea
                id="create-notes"
                value={form.notes}
                onChange={(e) => onChange("notes", e.target.value)}
                className="min-h-20"
                placeholder="Setup, dietary, AV requirements…"
              />
              <p className="text-xs text-muted-foreground">Only visible to your team.</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ScheduleSection({ form, onChange }: EventFormProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="font-medium">Recurrence</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Stored on the event; generated instances come later.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Repeats</Label>
            <Select
              value={form.recurring}
              onValueChange={(value) => value && onChange("recurring", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={form.recurrenceFrequency || "none"}
              onValueChange={(value) =>
                value && onChange("recurrenceFrequency", value === "none" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-recurrence-interval">Interval</Label>
            <Input
              id="create-recurrence-interval"
              type="number"
              min="1"
              value={form.recurrenceInterval}
              onChange={(e) => onChange("recurrenceInterval", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-recurrence-end">End date</Label>
            <DatePicker
              id="create-recurrence-end"
              value={form.recurrenceEndDate}
              onChange={(value) => onChange("recurrenceEndDate", value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="create-recurrence-days">Days of week</Label>
            <Input
              id="create-recurrence-days"
              value={form.recurrenceDays}
              onChange={(e) => onChange("recurrenceDays", e.target.value)}
              placeholder="monday, wednesday"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourcesSection({
  resources,
  resourceAssignments,
  onResourceAssignmentsChange,
}: EventFormProps) {
  return (
    <ResourceAssignmentEditor
      resources={resources}
      assignments={resourceAssignments}
      onChange={onResourceAssignmentsChange}
    />
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

function ResourceAssignmentEditor({
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
