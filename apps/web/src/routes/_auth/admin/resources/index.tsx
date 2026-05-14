import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from "lucide-react";
import type { ResourceDto, ResourceType } from "@workspace/contracts";
import { getCurrentOrg } from "@/lib/org";
import { canDeleteResources, canManageResources } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resourcesQueryOptions } from "@/queries/resources";
import { eventsQueryOptions } from "@/queries/events";
import { useArchiveResource, useUnarchiveResource } from "@/hooks/use-resources";
import { formatCost, resourceTypeLabels, resourceTypes } from "@/lib/resource-form";
import { CreateResourceDialog, EditResourceDialog } from "./~components/resource-dialog";
import { DeleteResourceDialog } from "./~components/delete-resource-dialog";
import { pageHead } from "@/lib/seo";

type TabValue = "all" | ResourceType;

export const Route = createFileRoute("/_auth/admin/resources/")({
  component: ResourcesPage,
  head: () => pageHead("Resources"),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(resourcesQueryOptions({ includeArchived: true })),
});

function ResourcesPage() {
  const orgContext = Route.useRouteContext() as Awaited<ReturnType<typeof getCurrentOrg>>;
  const canManage = canManageResources(orgContext.memberRole);
  const canDelete = canDeleteResources(orgContext.memberRole);

  const [tab, setTab] = useState<TabValue>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceDto | null>(null);
  const [deleting, setDeleting] = useState<ResourceDto | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const eventsQuery = useQuery(eventsQueryOptions);
  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      for (const t of e.tags ?? []) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => b.date.localeCompare(a.date)),
    [events],
  );

  const {
    data: { resources },
  } = useSuspenseQuery(
    resourcesQueryOptions({
      includeArchived: true,
      eventIds: selectedEventIds,
      eventTags: selectedTags,
    }),
  );

  const activeFilterCount = selectedEventIds.length + selectedTags.length;
  const clearFilters = () => {
    setSelectedEventIds([]);
    setSelectedTags([]);
  };
  const toggleEventId = (id: string) =>
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (!showArchived && r.archivedAt) return false;
      if (tab !== "all" && r.type !== tab) return false;
      if (search) {
        const haystack = `${r.name} ${r.description ?? ""} ${r.email ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [resources, search, showArchived, tab]);

  const counts = useMemo(() => {
    const result: Record<TabValue, number> = {
      all: 0,
      instructor: 0,
      material: 0,
      location: 0,
      equipment: 0,
      custom: 0,
    };
    for (const r of resources) {
      if (!showArchived && r.archivedAt) continue;
      result.all += 1;
      result[r.type] += 1;
    }
    return result;
  }, [resources, showArchived]);

  const defaultCreateType: ResourceType = tab === "all" ? "instructor" : tab;

  return (
    <AppShell
      title="Resources"
      description="Instructors, locations, materials, and equipment your team assigns to events."
      headerActions={
        canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New resource
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            {resourceTypes.map((type) => (
              <TabsTrigger key={type} value={type}>
                {resourceTypeLabels[type]} ({counts[type]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or description"
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-3">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
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
              <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0" align="end">
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-4 border-b pb-3">
                    <div>
                      <h4 className="text-sm font-semibold tracking-tight">Filter resources</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Show resources assigned to selected events or tags.
                      </p>
                    </div>
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-3xs">
                        {activeFilterCount} active
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground">Events</Label>
                    {sortedEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No events available.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
                        {sortedEvents.map((e) => {
                          const id = `event-filter-${e.id}`;
                          const checked = selectedEventIds.includes(e.id);
                          return (
                            <label
                              key={e.id}
                              htmlFor={id}
                              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/50"
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={() => toggleEventId(e.id)}
                              />
                              <span className="flex-1 truncate">{e.title}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {e.date}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground">Event tags</Label>
                    {allTags.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tags on any event yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {allTags.map((tag) => {
                          const checked = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors " +
                                (checked
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted")
                              }
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={clearFilters}
                      disabled={activeFilterCount === 0}
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

            <div className="flex items-center gap-2">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
                Show archived
              </Label>
            </div>
          </div>
        </div>

        {!canManage && <p className="text-xs text-muted-foreground">Viewer role — read-only</p>}

        {filtered.length === 0 ? (
          <ResourcesEmpty searchActive={Boolean(search)} tab={tab} />
        ) : (
          <ResourcesTable
            resources={filtered}
            canManage={canManage}
            canDelete={canDelete}
            onEdit={setEditing}
            onDelete={setDeleting}
            onError={setError}
          />
        )}
      </div>

      {createOpen && (
        <CreateResourceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultType={defaultCreateType}
          onError={setError}
        />
      )}

      {editing && (
        <EditResourceDialog
          resource={editing}
          onClose={() => setEditing(null)}
          onError={setError}
        />
      )}

      {deleting && (
        <DeleteResourceDialog
          resource={deleting}
          onClose={() => setDeleting(null)}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

function ResourcesTable({
  resources,
  canManage,
  canDelete,
  onEdit,
  onDelete,
  onError,
}: {
  resources: ResourceDto[];
  canManage: boolean;
  canDelete: boolean;
  onEdit: (resource: ResourceDto) => void;
  onDelete: (resource: ResourceDto) => void;
  onError: (message: string) => void;
}) {
  const archiveMutation = useArchiveResource();
  const unarchiveMutation = useUnarchiveResource();

  const handleArchiveToggle = (resource: ResourceDto) => {
    const mutation = resource.archivedAt ? unarchiveMutation : archiveMutation;
    mutation.mutate(resource.id, {
      onError: (error) =>
        onError(error instanceof Error ? error.message : "Unable to update resource"),
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10">Name</TableHead>
            <TableHead className="h-10">Type</TableHead>
            <TableHead className="h-10">Capacity</TableHead>
            <TableHead className="h-10">Cost</TableHead>
            <TableHead className="h-10">Updated</TableHead>
            <TableHead className="h-10 w-32" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => (
            <TableRow key={resource.id} className="hover:bg-muted/40">
              <TableCell className="py-3 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Link
                    to="/admin/resources/$resourceId"
                    params={{ resourceId: resource.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {resource.name}
                  </Link>
                  {resource.archivedAt && (
                    <Badge variant="outline" className="text-xs">
                      Archived
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground capitalize">
                {resourceTypeLabels[resource.type]}
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                {resource.capacity ?? "—"}
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                {formatCost(resource)}
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                {resource.updatedAt.slice(0, 10)}
              </TableCell>
              <TableCell className="py-3 pr-3">
                <div className="flex items-center justify-end gap-1">
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit(resource)}
                        aria-label={`Edit ${resource.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleArchiveToggle(resource)}
                        disabled={archiveMutation.isPending || unarchiveMutation.isPending}
                        aria-label={
                          resource.archivedAt
                            ? `Unarchive ${resource.name}`
                            : `Archive ${resource.name}`
                        }
                      >
                        {resource.archivedAt ? (
                          <ArchiveRestore className="size-3.5" />
                        ) : (
                          <Archive className="size-3.5" />
                        )}
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(resource)}
                      aria-label={`Delete ${resource.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ResourcesEmpty({ searchActive, tab }: { searchActive: boolean; tab: TabValue }) {
  return (
    <EmptyState
      icon={<Wrench className="size-8" />}
      title={
        searchActive
          ? "No matching resources"
          : tab === "all"
            ? "No resources yet"
            : `No ${resourceTypeLabels[tab as ResourceType].toLowerCase()} resources yet`
      }
      description={
        searchActive
          ? "Try a different name or description."
          : "Resources are people, spaces, and items you assign to events."
      }
    />
  );
}
