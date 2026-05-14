import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { useEffect, useMemo, useState } from "react";
import { Calendar, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import type { EventDto, EventStatus, EventVisibility } from "@workspace/contracts";
import { AppShell } from "@/components/app-shell";
import { pageHead } from "@/lib/seo";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  defaultEventForm,
  formToEventRequest,
  updateEvent,
  type EventFormState,
} from "@/lib/events";
import { getCurrentOrg } from "@/lib/org";
import { canManageEvents } from "@/lib/permissions";
import { formatPrice } from "@/lib/public";
import { eventKeys, eventsQueryOptions } from "@/queries/events";
import { useCreateEvent, useDuplicateEvent } from "@/hooks/use-events";
import { resourcesQueryOptions } from "@/queries/resources";
import { uploadPublicAsset } from "@/lib/assets";
import { replaceEventResources } from "@/lib/resources";
import { StatusBadge, VisibilityBadge } from "./~components/event-badges";
import { FilterChip } from "./~components/filter-chip";
import { EventsTable, type SortKey } from "./~components/events-table";
import { EventForm } from "./~components/event-form";

type ViewMode = "list" | "kanban";
type EventSegment = "active" | "archived";
type ResourceAssignmentDraft = { resourceId: string; role: string; quantity: number };

const statuses: EventStatus[] = ["upcoming", "completed", "cancelled"];
const visibilities: EventVisibility[] = ["unpublished", "published"];
const ITEMS_PER_PAGE = 10;

const sortLabels: Record<SortKey, string> = {
  title: "Title",
  date: "Date",
  status: "Status",
  visibility: "Visibility",
  registrationCount: "Registrations",
  category: "Category",
  price: "Price",
  location: "Location",
};

function isArchived(event: Pick<EventDto, "archivedAt">) {
  return event.archivedAt !== null;
}

export const Route = createFileRoute("/_auth/admin/events/")({
  component: Events,
  head: () => pageHead("Events"),
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQueryOptions),
});

function Events() {
  const orgContext = Route.useRouteContext() as Awaited<ReturnType<typeof getCurrentOrg>>;
  const role = orgContext.memberRole;
  const orgSlug = orgContext.org.slug;
  const canManage = canManageEvents(role);
  const [view, setView] = useState<ViewMode>("list");
  const [segment, setSegment] = useState<EventSegment>("active");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<EventFormState>(() => defaultEventForm());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);
  const [resourceAssignments, setResourceAssignments] = useState<ResourceAssignmentDraft[]>([]);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: { events },
  } = useSuspenseQuery(eventsQueryOptions);

  const createMutation = useCreateEvent();
  const duplicateMutation = useDuplicateEvent();
  const { data: resourcesData } = useQuery({
    ...resourcesQueryOptions({ includeArchived: true }),
    enabled: createOpen,
  });

  const categories = useMemo(
    () => [...new Set(events.map((event) => event.category).filter(Boolean))] as string[],
    [events],
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [segment, search, category, status, visibility, sortKey]);

  const filteredEvents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events
      .filter((event) => {
        const archived = isArchived(event);
        const active = !archived;
        const matchesSegment = segment === "active" ? active : archived;

        const matchesSearch =
          needle.length === 0 ||
          event.title.toLowerCase().includes(needle) ||
          (event.description ?? "").toLowerCase().includes(needle) ||
          (event.location ?? "").toLowerCase().includes(needle);
        const matchesCategory = category === "all" || event.category === category;
        const matchesStatus = status === "all" || event.status === status;
        const matchesVisibility = visibility === "all" || event.visibility === visibility;
        return (
          matchesSegment && matchesSearch && matchesCategory && matchesStatus && matchesVisibility
        );
      })
      .sort((a, b) => compareEvents(a, b, sortKey));
  }, [category, events, search, segment, sortKey, status, visibility]);

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEvents, page]);

  const activeFilterCount = [category, status, visibility].filter((v) => v !== "all").length;

  const updateForm = (field: keyof EventFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      const { event: createdEvent } = await createMutation.mutateAsync(formToEventRequest(form));
      const assignments = resourceAssignments.filter(
        (assignment) => assignment.resourceId && assignment.role.trim(),
      );
      if (assignments.length > 0) {
        await replaceEventResources(createdEvent.id, {
          resources: assignments.map((assignment) => ({
            resourceId: assignment.resourceId,
            role: assignment.role.trim(),
            quantity: assignment.quantity > 0 ? assignment.quantity : 1,
          })),
        });
      }
      const uploadErrors: string[] = [];
      if (coverFile) {
        try {
          await uploadPublicAsset({
            file: coverFile,
            kind: "event_image",
            role: "cover",
            eventId: createdEvent.id,
          });
        } catch (error) {
          uploadErrors.push(
            error instanceof Error ? error.message : "Unable to upload cover image",
          );
        }
      }
      for (const file of detailFiles) {
        try {
          await uploadPublicAsset({
            file,
            kind: "event_image",
            role: "detail",
            eventId: createdEvent.id,
          });
        } catch (error) {
          uploadErrors.push(
            error instanceof Error ? error.message : `Unable to upload ${file.name}`,
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      setForm(defaultEventForm());
      setCoverFile(null);
      setDetailFiles([]);
      setResourceAssignments([]);
      setCreateOpen(false);
      if (uploadErrors.length > 0) {
        setError(`Event created, but some images failed to upload: ${uploadErrors.join(", ")}`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create event");
    }
  };

  const handleDuplicate = (eventId: string) => {
    setError("");
    duplicateMutation.mutate(eventId, {
      onError: (error) =>
        setError(error instanceof Error ? error.message : "Unable to duplicate event"),
    });
  };

  const eventCounts = useMemo(() => {
    const archived = events.filter(isArchived).length;
    const active = events.length - archived;
    return { active, archived };
  }, [events]);

  const clearFilters = () => {
    setCategory("all");
    setStatus("all");
    setVisibility("all");
    setSortKey("date");
  };

  return (
    <AppShell
      title="Events"
      description="Create, filter, sort, and schedule event work."
      headerActions={
        <Button size="sm" disabled={!canManage} onClick={() => setCreateOpen(true)}>
          New event
        </Button>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl lg:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create event</DialogTitle>
            </DialogHeader>
            <EventForm
              key={createOpen ? "open" : "closed"}
              form={form}
              onChange={updateForm}
              onSubmit={handleCreate}
              submitLabel={createMutation.isPending ? "Creating..." : "Create event"}
              disabled={createMutation.isPending}
              resources={resourcesData?.resources ?? []}
              resourceAssignments={resourceAssignments}
              onResourceAssignmentsChange={setResourceAssignments}
              coverFile={coverFile}
              detailFiles={detailFiles}
              onCoverFileChange={setCoverFile}
              onDetailFilesChange={setDetailFiles}
            />
          </DialogContent>
        </Dialog>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Toolbar: tabs | search + filter + view + new */}
        <div className="flex flex-col gap-3 rounded-2xl border bg-background/80 p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={segment} onValueChange={(v) => setSegment(v as EventSegment)}>
            <TabsList>
              <TabsTrigger value="active">
                Active
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-3xs">
                  {eventCounts.active}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="archived">
                Archived
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-3xs">
                  {eventCounts.archived}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events"
                className="h-8 min-w-40 pl-8 text-sm sm:w-48"
              />
            </div>

            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <SlidersHorizontal className="size-3.5" />
                    Filter
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-3xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                }
              />
              <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="end">
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-4 border-b pb-3">
                    <div>
                      <h4 className="text-sm font-semibold tracking-tight">Filter and sort</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Refine the Events workspace.
                      </p>
                    </div>
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-3xs">
                        {activeFilterCount} active
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-foreground">Sort by</Label>
                      <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                        <SelectTrigger className="h-9 w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} className="min-w-56">
                          {(Object.entries(sortLabels) as [SortKey, string][]).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-foreground">Category</Label>
                        <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                          <SelectTrigger className="h-9 w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false} className="min-w-44">
                            <SelectItem value="all">All categories</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-foreground">Status</Label>
                        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                          <SelectTrigger className="h-9 w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false} className="min-w-40">
                            <SelectItem value="all">All statuses</SelectItem>
                            {statuses.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-foreground">Visibility</Label>
                        <Select value={visibility} onValueChange={(v) => v && setVisibility(v)}>
                          <SelectTrigger className="h-9 w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false} className="min-w-44">
                            <SelectItem value="all">All visibilities</SelectItem>
                            {visibilities.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={clearFilters}
                      disabled={activeFilterCount === 0 && sortKey === "date"}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setFilterOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div
              role="radiogroup"
              aria-label="Event view"
              className="flex items-center rounded-lg border bg-muted/30 p-1"
            >
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                role="radio"
                aria-checked={view === "list"}
                aria-label="List view"
                className="h-7 w-7 p-0"
                onClick={() => setView("list")}
              >
                <List className="size-3.5" />
              </Button>
              <Button
                variant={view === "kanban" ? "secondary" : "ghost"}
                size="sm"
                role="radio"
                aria-checked={view === "kanban"}
                aria-label="Kanban view"
                className="h-7 w-7 p-0"
                onClick={() => setView("kanban")}
              >
                <LayoutGrid className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {category !== "all" && (
              <FilterChip label="Category" value={category} onClear={() => setCategory("all")} />
            )}
            {status !== "all" && (
              <FilterChip label="Status" value={status} onClear={() => setStatus("all")} />
            )}
            {visibility !== "all" && (
              <FilterChip
                label="Visibility"
                value={visibility}
                onClear={() => setVisibility("all")}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-3xs"
              onClick={clearFilters}
            >
              Clear all
            </Button>
          </div>
        )}

        {!canManage && <p className="text-xs text-muted-foreground">Viewer role — read-only</p>}

        {/* Content */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={<Calendar className="size-8" />}
            title={segment === "active" ? "No active events" : "No archived events"}
            description={
              segment === "active"
                ? "Create a new event to get started."
                : "Archived events appear here."
            }
            className="rounded-2xl bg-background/70 shadow-xs"
          />
        ) : view === "list" ? (
          <EventsTable
            events={paginatedEvents}
            orgSlug={orgSlug}
            sortKey={sortKey}
            setSortKey={setSortKey}
            canManage={canManage}
            onDuplicate={handleDuplicate}
            onError={setError}
          />
        ) : (
          <EventsKanban events={paginatedEvents} canManage={canManage} onError={setError} />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 rounded-2xl border bg-background/80 p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(page * ITEMS_PER_PAGE, filteredEvents.length)} of {filteredEvents.length}
            </p>
            <div className="flex flex-wrap items-center gap-1 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function compareEvents(a: EventDto, b: EventDto, sortKey: SortKey) {
  if (sortKey === "registrationCount") {
    return registrationCount(a) - registrationCount(b);
  }
  if (sortKey === "price") {
    return a.price - b.price;
  }
  if (sortKey === "date") {
    return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  }
  return String(a[sortKey] ?? "")
    .toLowerCase()
    .localeCompare(String(b[sortKey] ?? "").toLowerCase());
}

function registrationCount(event: EventDto) {
  return event.confirmedRegistrations + event.waitlistedRegistrations;
}

function EventsKanban({
  events,
  canManage,
  onError,
}: {
  events: EventDto[];
  canManage: boolean;
  onError: (message: string) => void;
}) {
  const grouped = Object.fromEntries(
    statuses.map((status) => [status, events.filter((event) => event.status === status)]),
  ) as Record<EventStatus, EventDto[]>;
  const patchByEvent = new Map(events.map((event) => [event.id, event]));
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: EventStatus }) =>
      updateEvent(eventId, { status }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(variables.eventId) }),
      ]);
    },
  });

  return (
    <DragDropProvider
      onDragEnd={(dragEvent) => {
        const operation = (dragEvent as any).operation;
        const sourceId = operation?.source?.id as string | undefined;
        const targetId = operation?.target?.id as EventStatus | undefined;
        if (!sourceId || !targetId || !statuses.includes(targetId)) return;
        const event = patchByEvent.get(sourceId);
        if (!event || event.status === targetId) return;
        statusMutation.mutate(
          { eventId: sourceId, status: targetId },
          {
            onError: (error) =>
              onError(error instanceof Error ? error.message : "Unable to update event"),
          },
        );
      }}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {statuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            events={grouped[status]}
            canManage={canManage}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}

function KanbanColumn({
  status,
  events,
  canManage,
}: {
  status: EventStatus;
  events: EventDto[];
  canManage: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({ id: status, type: "column", accept: "event" });
  return (
    <section
      ref={ref}
      className={`min-h-80 rounded-2xl border bg-background/80 p-4 shadow-xs transition-[box-shadow,ring-color,transform] ${isDropTarget ? "-translate-y-0.5 shadow-md ring-2 ring-primary/70" : ""}`}
    >
      <div className="mb-4 flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground">{events.length}</span>
        </div>
      </div>
      <div className="space-y-3">
        {events.map((event) => (
          <KanbanCard key={event.id} event={event} canManage={canManage} />
        ))}
      </div>
    </section>
  );
}

function KanbanCard({ event, canManage }: { event: EventDto; canManage: boolean }) {
  const { ref, handleRef, isDragSource } = useDraggable({
    id: event.id,
    type: "event",
    disabled: !canManage,
  });

  return (
    <article
      ref={ref}
      className={`rounded-xl border bg-card p-4 shadow-xs transition-[box-shadow,transform,opacity] hover:-translate-y-0.5 hover:shadow-md ${isDragSource ? "scale-[0.99] opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/admin/events/$eventId/edit"
            params={{ eventId: event.id }}
            className="font-semibold tracking-tight underline-offset-4 hover:underline"
          >
            {event.title}
          </Link>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {event.date} at {event.time}
          </p>
        </div>
        <Button
          ref={handleRef as any}
          variant="ghost"
          size="sm"
          disabled={!canManage}
          className="cursor-grab text-xs text-muted-foreground"
        >
          Drag
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <VisibilityBadge visibility={event.visibility} />
        {event.category && (
          <Badge variant="outline" className="h-5 px-1.5 text-3xs">
            {event.category}
          </Badge>
        )}
        <Badge variant="outline" className="h-5 px-1.5 text-3xs">
          {event.price === 0 ? "Free" : formatPrice(event.price, "USD")}
        </Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-3xs">
          {event.confirmedRegistrations}
          {event.maxCapacity !== null && event.maxCapacity > 0 && `/${event.maxCapacity}`}
          {event.waitlistedRegistrations > 0 && ` +${event.waitlistedRegistrations} waitlisted`}
        </Badge>
      </div>
    </article>
  );
}
