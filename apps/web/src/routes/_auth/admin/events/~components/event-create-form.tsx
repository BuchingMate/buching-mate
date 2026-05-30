import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Pencil, ShieldCheck, Users } from "lucide-react";
import type { MemberDto, ResourceDto } from "@workspace/contracts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencySymbol } from "@/lib/public";
import { useOrgCurrency } from "@/hooks/use-org";
import {
  type ResourceAssignmentDraft,
  ImageFilePicker,
  ResourceAssignmentEditor,
  ScheduleSection,
} from "./event-form-parts";
import { CategoryChip, VisibilityChip } from "./event-chips";
import { LocationField, type RecentLocation } from "./location-field";
import { ScheduleFields } from "./schedule-fields";
import { useEventFormFields } from "./use-event-form-fields";
import type { useEventCreateForm } from "./use-event-create-form";

type Props = {
  form: ReturnType<typeof useEventCreateForm>;
  canManage: boolean;
  members: MemberDto[];
  resources: ResourceDto[];
  resourceAssignments: ResourceAssignmentDraft[];
  onResourceAssignmentsChange: (assignments: ResourceAssignmentDraft[]) => void;
  coverFile: File | null;
  detailFiles: File[];
  onCoverFileChange: (file: File | null) => void;
  onDetailFilesChange: (files: File[]) => void;
  recentLocations: RecentLocation[];
  zoomConnected: boolean;
  onConnectZoom: () => void;
};

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "schedule", label: "Date & time" },
  { id: "details", label: "Location & details" },
  { id: "options", label: "Tickets & access" },
  { id: "advanced", label: "More options" },
] as const;

export function EventCreateForm(props: Props) {
  const { form, canManage, members } = props;
  const disabled = !canManage;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const symbol = currencySymbol(useOrgCurrency());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string>("basics");

  const { values, setField } = useEventFormFields(form);

  const endBeforeStart =
    Boolean(values.endDate && values.endTime && values.date && values.time) &&
    `${values.endDate}T${values.endTime}` < `${values.date}T${values.time}`;

  const done: Record<string, boolean> = {
    basics: values.title.trim().length > 0,
    schedule:
      Boolean(values.date && values.time && values.endDate && values.endTime) && !endBeforeStart,
    details: values.location.trim().length > 0 || values.description.trim().length > 0,
    options: values.requireApproval !== "true" || values.reviewerId !== "",
    advanced:
      values.category.trim() !== "" || values.tags.trim() !== "" || values.notes.trim() !== "",
  };

  // Scroll-spy: highlight the section currently in view within the right column.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { root, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    root.querySelectorAll("[data-section]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const jumpTo = (id: string) => {
    scrollRef.current?.querySelector(`#section-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="grid gap-10 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left rail: cover on top, vertical stepper below */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-6 lg:overflow-y-auto lg:py-1">
          <ImageFilePicker
            file={props.coverFile}
            disabled={disabled}
            emptyTitle="Cover image"
            emptyDescription="JPG, PNG, WebP or GIF"
            onChange={props.onCoverFileChange}
          />
          <ol className="relative space-y-1">
            <span className="absolute top-4 bottom-4 left-[15px] w-px bg-border" aria-hidden />
            {STEPS.map((step, i) => {
              const isActive = activeId === step.id;
              const isDone = done[step.id];
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(step.id)}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border bg-background text-[10px] font-semibold transition-colors",
                        isDone
                          ? "border-primary bg-primary text-primary-foreground"
                          : isActive
                            ? "border-foreground text-foreground"
                            : "border-muted-foreground/40 text-muted-foreground",
                      )}
                    >
                      {isDone ? <Check className="size-3" /> : i + 1}
                    </span>
                    {step.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Right column: scrolls independently */}
        <div ref={scrollRef} className="space-y-10 lg:overflow-y-auto lg:pr-1 lg:pb-24">
          {/* Basics */}
          <Section id="basics">
            <div className="space-y-4">
              <div className="lg:hidden">
                <ImageFilePicker
                  file={props.coverFile}
                  disabled={disabled}
                  emptyTitle="Cover image"
                  emptyDescription="JPG, PNG, WebP or GIF"
                  onChange={props.onCoverFileChange}
                />
              </div>
              {/* Luma-style chips above the title. */}
              <div className="flex flex-wrap items-center gap-2">
                <VisibilityChip
                  value={values.visibility}
                  disabled={disabled}
                  onChange={(v) => setField("visibility", v)}
                />
                <CategoryChip
                  value={values.category}
                  disabled={disabled}
                  onChange={(v) => setField("category", v)}
                />
              </div>
              <form.Field name="title">
                {(field) => (
                  <div className="space-y-1">
                    <Input
                      value={field.state.value}
                      disabled={disabled}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="Event name"
                      aria-label="Event name"
                      className="h-auto border-0 bg-transparent px-0 py-1 text-4xl leading-tight font-bold tracking-tight shadow-none md:text-5xl placeholder:text-muted-foreground/30 focus-visible:ring-0"
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>
            </div>
          </Section>

          {/* Schedule */}
          <Section id="schedule">
            <ScheduleFields form={values} onChange={setField} disabled={disabled}>
              <ScheduleSection form={values} onChange={setField} disabled={disabled} />
            </ScheduleFields>
          </Section>

          {/* Location & details */}
          <Section id="details">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" /> Location
              </Label>
              <LocationField
                value={values.location}
                disabled={disabled}
                recentLocations={props.recentLocations}
                videoProvider={values.videoProvider}
                zoomConnected={props.zoomConnected}
                onConnectZoom={props.onConnectZoom}
                onVideoProviderChange={(p) => setField("videoProvider", p)}
                onChange={(v) => setField("location", v)}
                onCoords={(lat, lng) => {
                  setField("locationLat", lat);
                  setField("locationLng", lng);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Search an address, paste a virtual link, or create a Zoom meeting.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={values.description}
                disabled={disabled}
                onChange={(e) => setField("description", e.target.value)}
                className="min-h-32"
                placeholder="Tell people what to expect — agenda, who it's for, what to bring."
              />
            </div>
          </Section>

          {/* Tickets & access */}
          <Section id="options">
            <div className="divide-y rounded-xl border">
              <OptionRow icon={<span className="text-base">🎟️</span>} label="Ticket price">
                <div className="relative w-32">
                  <Input
                    value={values.price}
                    disabled={disabled}
                    onChange={(e) => setField("price", e.target.value)}
                    placeholder="0.00"
                    className="h-8 pr-7 text-right"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs font-medium text-muted-foreground">
                    {symbol}
                  </span>
                </div>
              </OptionRow>
              <OptionRow icon={<Users className="size-4 text-muted-foreground" />} label="Capacity">
                <CapacityField
                  value={values.maxCapacity}
                  disabled={disabled}
                  onChange={(v) => setField("maxCapacity", v)}
                />
              </OptionRow>
              <div className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-sm">
                    <ShieldCheck className="size-4 text-muted-foreground" /> Require approval
                  </span>
                  <Switch
                    checked={values.requireApproval === "true"}
                    disabled={disabled}
                    onCheckedChange={(c) => setField("requireApproval", c ? "true" : "false")}
                  />
                </div>
                {values.requireApproval === "true" && (
                  <form.Field name="reviewerId">
                    {(field) => (
                      <div className="mt-3 space-y-1.5 border-t pt-3">
                        <Label className="text-xs text-muted-foreground">
                          Reviewer — approves before this event can be published
                        </Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(v) => v && field.handleChange(v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose a reviewer" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((m) => (
                              <SelectItem key={m.userId} value={m.userId}>
                                {m.name || m.email || m.userId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </form.Field>
                )}
              </div>
            </div>
          </Section>

          {/* Advanced */}
          <Section id="advanced">
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
                <span className="flex flex-col">
                  {advancedOpen ? "Hide" : "Show"} more options
                  <span className="text-xs font-normal text-muted-foreground">
                    Organize, assign resources &amp; add internal notes
                  </span>
                </span>
                <ChevronDown
                  className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 rounded-xl border border-t-0 p-4">
                <OptionGroup title="Organize" description="Help people find and group this event.">
                  <div className="space-y-1.5">
                    <Label htmlFor="adv-tags">Tags</Label>
                    <Input
                      id="adv-tags"
                      value={values.tags}
                      disabled={disabled}
                      onChange={(e) => setField("tags", e.target.value)}
                      placeholder="Comma separated"
                    />
                  </div>
                </OptionGroup>

                <OptionGroup
                  title="Resources"
                  description="Assign rooms, equipment or staff to this event."
                >
                  <ResourceAssignmentEditor
                    resources={props.resources}
                    assignments={props.resourceAssignments}
                    onChange={props.onResourceAssignmentsChange}
                  />
                </OptionGroup>

                <OptionGroup
                  title="Team"
                  description="Only visible to your team — never to attendees."
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="adv-notes">Internal notes</Label>
                    <Textarea
                      id="adv-notes"
                      value={values.notes}
                      disabled={disabled}
                      onChange={(e) => setField("notes", e.target.value)}
                      className="min-h-20"
                      placeholder="Prep reminders, contacts, anything your team should know."
                    />
                  </div>
                </OptionGroup>
              </CollapsibleContent>
            </Collapsible>
          </Section>

          <div className="flex justify-end gap-2 border-t pt-4">
            <form.Subscribe
              selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" size="lg" disabled={disabled || !canSubmit || isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create event"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </div>
      </div>
    </form>
  );
}

function OptionGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function FieldError({ errors }: { errors: readonly unknown[] }) {
  const messages = errors
    .map((e) => (typeof e === "string" ? e : ((e as { message?: string })?.message ?? "")))
    .filter(Boolean);
  if (messages.length === 0) return null;
  return <p className="text-xs text-destructive">{messages.join(", ")}</p>;
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${id}`} data-section className="scroll-mt-4 space-y-4">
      {title && (
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function CapacityField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const limited = value !== "" && value !== "0";
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 font-normal" disabled={disabled}>
            {limited ? value : "Unlimited"}
            <Pencil className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72 space-y-3 p-4">
        <div>
          <p className="text-sm font-medium">Capacity</p>
          <p className="text-xs text-muted-foreground">
            Close registration once the limit is reached.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm">Limit capacity</Label>
          <Switch checked={limited} onCheckedChange={(checked) => onChange(checked ? "50" : "")} />
        </div>
        {limited && (
          <Input
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
            placeholder="50"
            autoFocus
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function OptionRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <span className="flex items-center gap-2.5 text-sm">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
