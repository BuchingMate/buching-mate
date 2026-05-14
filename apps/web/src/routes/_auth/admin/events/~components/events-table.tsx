import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ArchiveRestore, Copy, ExternalLink, MoreHorizontal, Pencil } from "lucide-react";
import type { EventDto } from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePatchEvent } from "@/hooks/use-events";
import { formatPrice, getOrgPublicUrl } from "@/lib/public";
import { eventRegistrationsQueryOptions } from "@/queries/registrations";
import { StatusBadge, VisibilityBadge } from "./event-badges";
import { RegistrationsTable } from "./registrations-table";

export type SortKey =
  | "title"
  | "date"
  | "status"
  | "visibility"
  | "registrationCount"
  | "category"
  | "price"
  | "location";

function isArchived(event: Pick<EventDto, "archivedAt">) {
  return event.archivedAt !== null;
}

function getArchivePatch(event: Pick<EventDto, "archivedAt">) {
  if (isArchived(event)) {
    return { archivedAt: null };
  }

  return { archivedAt: new Date().toISOString() };
}

export function EventsTable({
  events,
  orgSlug,
  sortKey,
  setSortKey,
  canManage,
  onDuplicate,
  onError,
}: {
  events: EventDto[];
  orgSlug: string | null;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  canManage: boolean;
  onDuplicate: (eventId: string) => void;
  onError: (message: string) => void;
}) {
  const [registrationEvent, setRegistrationEvent] = useState<EventDto | null>(null);
  const { data: registrationsData, isPending: registrationsLoading } = useQuery({
    ...eventRegistrationsQueryOptions(registrationEvent?.id ?? ""),
    enabled: registrationEvent !== null,
  });
  const registrations = registrationsData?.registrations ?? [];

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border bg-background/80 shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead
                label="Label"
                value="title"
                sortKey={sortKey}
                setSortKey={setSortKey}
                className="sticky left-0 z-20 w-40 min-w-40 border-r bg-background"
              />
              <SortableHead label="Date" value="date" sortKey={sortKey} setSortKey={setSortKey} />
              <SortableHead
                label="Location"
                value="location"
                sortKey={sortKey}
                setSortKey={setSortKey}
                className="hidden xl:table-cell"
              />
              <SortableHead
                label="Status"
                value="status"
                sortKey={sortKey}
                setSortKey={setSortKey}
              />
              <SortableHead
                label="Visibility"
                value="visibility"
                sortKey={sortKey}
                setSortKey={setSortKey}
              />
              <SortableHead
                label="Price"
                value="price"
                sortKey={sortKey}
                setSortKey={setSortKey}
                className="hidden md:table-cell"
              />
              <SortableHead
                label="Registrations"
                value="registrationCount"
                sortKey={sortKey}
                setSortKey={setSortKey}
              />
              <SortableHead
                label="Category"
                value="category"
                sortKey={sortKey}
                setSortKey={setSortKey}
                className="hidden lg:table-cell"
              />
              <TableHead className="sticky right-0 z-20 w-10 border-l bg-background"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                orgSlug={orgSlug}
                canManage={canManage}
                onDuplicate={onDuplicate}
                onError={onError}
                onRegistrationsClick={setRegistrationEvent}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={registrationEvent !== null}
        onOpenChange={(open) => !open && setRegistrationEvent(null)}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{registrationEvent?.title ?? "Event"} registrations</DialogTitle>
            <DialogDescription>
              {registrationsLoading
                ? "Loading attendees..."
                : `${registrations.length} attendee${registrations.length === 1 ? "" : "s"}`}
            </DialogDescription>
          </DialogHeader>
          {registrationEvent && !registrationsLoading && (
            <RegistrationsTable
              eventId={registrationEvent.id}
              eventTitle={registrationEvent.title}
              registrations={registrations}
              canManage={false}
              canDelete={false}
              onAddClick={() => undefined}
              onError={onError}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortableHead({
  label,
  value,
  sortKey,
  setSortKey,
  className,
}: {
  label: string;
  value: SortKey;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <TableHead className={`h-8 py-0 ${className ?? ""}`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setSortKey(value)}
      >
        {label}
        {sortKey === value && <span className="ml-0.5">↑</span>}
      </Button>
    </TableHead>
  );
}

function EventRow({
  event,
  orgSlug,
  canManage,
  onDuplicate,
  onError,
  onRegistrationsClick,
}: {
  event: EventDto;
  orgSlug: string | null;
  canManage: boolean;
  onDuplicate: (eventId: string) => void;
  onError: (message: string) => void;
  onRegistrationsClick: (event: EventDto) => void;
}) {
  const patchMutation = usePatchEvent(event.id);
  const publicEventUrl =
    orgSlug && event.visibility === "published"
      ? getOrgPublicUrl(orgSlug, `/events/${event.id}`)
      : null;
  const updateEvent = (input: Partial<Pick<EventDto, "archivedAt" | "status" | "visibility">>) => {
    patchMutation.mutate(input, {
      onError: (error) =>
        onError(error instanceof Error ? error.message : "Unable to update event"),
    });
  };
  const archived = isArchived(event);

  return (
    <TableRow className="group hover:bg-muted/40">
      <TableCell className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r bg-background py-2 group-hover:bg-muted/40">
        <Link
          to="/admin/events/$eventId/edit"
          params={{ eventId: event.id }}
          className="block truncate font-medium text-sm underline-offset-4 hover:underline"
        >
          {event.title}
        </Link>
      </TableCell>
      <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
        {event.date}
        <span className="text-muted-foreground/60"> · {event.time}</span>
      </TableCell>
      <TableCell className="hidden max-w-48 py-2 text-xs text-muted-foreground xl:table-cell">
        <span className="block truncate" title={event.location ?? undefined}>
          {event.location ?? "—"}
        </span>
      </TableCell>
      <TableCell className="py-2">
        <StatusBadge status={event.status} />
      </TableCell>
      <TableCell className="py-2">
        <VisibilityBadge visibility={event.visibility} />
      </TableCell>
      <TableCell className="hidden py-2 text-xs font-medium tabular-nums md:table-cell">
        {event.price === 0 ? "Free" : formatPrice(event.price, "USD")}
      </TableCell>
      <TableCell className="py-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => onRegistrationsClick(event)}
          className="rounded px-1 py-0.5 tabular-nums underline-offset-4 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {event.confirmedRegistrations}
        </button>
        {event.maxCapacity !== null && event.maxCapacity > 0 && (
          <span className="text-muted-foreground/60"> /{event.maxCapacity}</span>
        )}
        {event.waitlistedRegistrations > 0 && (
          <span className="ml-1 text-warning-foreground dark:text-warning">
            +{event.waitlistedRegistrations} waitlisted
          </span>
        )}
      </TableCell>
      <TableCell className="hidden py-2 text-xs text-muted-foreground lg:table-cell">
        {event.category ?? "—"}
      </TableCell>
      <TableCell className="sticky right-0 z-10 w-10 border-l bg-background py-2 group-hover:bg-muted/40">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label={`Actions for ${event.title}`}
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <Link
                to="/admin/events/$eventId/edit"
                params={{ eventId: event.id }}
                className="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <Pencil className="size-3.5" />
                {canManage ? "Edit" : "View"}
              </Link>
              {canManage && (
                <>
                  {event.visibility !== "published" && (
                    <DropdownMenuItem
                      onClick={() => updateEvent({ visibility: "published" })}
                      disabled={patchMutation.isPending}
                      className="gap-2"
                    >
                      <ExternalLink className="size-3.5" />
                      Publish
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onDuplicate(event.id)} className="gap-2">
                    <Copy className="size-3.5" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateEvent(getArchivePatch(event))}
                    disabled={patchMutation.isPending}
                    className="gap-2"
                  >
                    {archived ? (
                      <ArchiveRestore className="size-3.5" />
                    ) : (
                      <Archive className="size-3.5" />
                    )}
                    {archived ? "Unarchive" : "Archive"}
                  </DropdownMenuItem>
                </>
              )}
              {publicEventUrl && (
                <>
                  <DropdownMenuSeparator />
                  <a
                    href={publicEventUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                    Go to event page
                  </a>
                  <DropdownMenuItem
                    onClick={() => void navigator.clipboard.writeText(publicEventUrl)}
                    className="gap-2"
                  >
                    <Copy className="size-3.5" />
                    Copy public link
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
