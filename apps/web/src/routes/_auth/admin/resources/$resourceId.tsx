import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import type { ResourceUsageDto } from "@workspace/contracts";
import {
  AppShell,
  PageBackButton,
  PageBreadcrumb,
  PageBreadcrumbCurrent,
  PageBreadcrumbSeparator,
} from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentOrg } from "@/lib/org";
import { canDeleteResources, canManageResources } from "@/lib/permissions";
import { formatCost, resourceTypeLabels } from "@/lib/resource-form";
import { resourceQueryOptions, resourceUsagesQueryOptions } from "@/queries/resources";
import { useArchiveResource, useUnarchiveResource } from "@/hooks/use-resources";
import { EditResourceDialog } from "./~components/resource-dialog";
import { DeleteResourceDialog } from "./~components/delete-resource-dialog";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_auth/admin/resources/$resourceId")({
  component: ResourceDetailRoute,
  head: () => pageHead("Resource"),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(resourceQueryOptions(params.resourceId)),
      context.queryClient.ensureQueryData(resourceUsagesQueryOptions(params.resourceId)),
    ]),
});

function ResourceDetailRoute() {
  const { resourceId } = Route.useParams();
  const orgContext = Route.useRouteContext() as Awaited<ReturnType<typeof getCurrentOrg>>;
  const canManage = canManageResources(orgContext.memberRole);
  const canDelete = canDeleteResources(orgContext.memberRole);
  const navigate = Route.useNavigate();

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const archiveMutation = useArchiveResource();
  const unarchiveMutation = useUnarchiveResource();

  const {
    data: { resource },
  } = useSuspenseQuery(resourceQueryOptions(resourceId));

  const {
    data: { usages },
  } = useSuspenseQuery(resourceUsagesQueryOptions(resourceId));

  const handleArchiveToggle = () => {
    const mutation = resource.archivedAt ? unarchiveMutation : archiveMutation;
    mutation.mutate(resource.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Unable to update resource"),
    });
  };

  return (
    <AppShell
      title={
        <PageBreadcrumb>
          <PageBackButton to="/admin/resources" label="Back to resources" />
          <Link to="/admin/resources" className="shrink-0 hover:underline">
            Resources
          </Link>
          <PageBreadcrumbSeparator />
          <PageBreadcrumbCurrent>{resource.name}</PageBreadcrumbCurrent>
        </PageBreadcrumb>
      }
      description={resource.description ?? resourceTypeLabels[resource.type]}
      headerActions={
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchiveToggle}
                disabled={archiveMutation.isPending || unarchiveMutation.isPending}
              >
                {resource.archivedAt ? (
                  <>
                    <ArchiveRestore className="size-3.5" />
                    Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="size-3.5" />
                    Archive
                  </>
                )}
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="rounded-2xl border bg-background p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Details</h2>
            <Badge variant="secondary" className="capitalize">
              {resourceTypeLabels[resource.type]}
            </Badge>
            {resource.archivedAt && <Badge variant="outline">Archived</Badge>}
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <DetailField label="Email" value={resource.email} />
            <DetailField label="Phone" value={resource.phone} />
            <DetailField
              label="Capacity"
              value={resource.capacity == null ? null : String(resource.capacity)}
            />
            <DetailField label="URL" value={resource.url} link />
            <DetailField
              label="Cost"
              value={formatCost(resource) === "—" ? null : formatCost(resource)}
            />
            <DetailField label="Updated" value={resource.updatedAt.slice(0, 10)} />
          </dl>
          {resource.notes && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Internal notes</p>
              <p className="mt-1 whitespace-pre-wrap">{resource.notes}</p>
            </div>
          )}
        </section>

        <UsagesSection usages={usages} />
      </div>

      {editing && (
        <EditResourceDialog
          resource={resource}
          onClose={() => setEditing(false)}
          onError={setError}
        />
      )}

      {deleting && (
        <DeleteResourceDialog
          resource={resource}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate({ to: "/admin/resources" })}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

function DetailField({
  label,
  value,
  link = false,
}: {
  label: string;
  value: string | null | undefined;
  link?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>
        {value ? (
          link ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline break-all"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

function UsagesSection({ usages }: { usages: ResourceUsageDto[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Used in events</h2>
        <span className="text-xs text-muted-foreground">{usages.length}</span>
      </div>
      {usages.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Not yet assigned to any event.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usages.map((u) => (
                <TableRow key={u.eventResourceId} className="hover:bg-muted/30">
                  <TableCell className="py-2 text-sm font-medium">
                    <Link
                      to="/admin/events/$eventId/edit"
                      params={{ eventId: u.eventId }}
                      className="underline-offset-4 hover:underline"
                    >
                      {u.eventTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {u.eventDate}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="capitalize">
                      {u.eventStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{u.role}</TableCell>
                  <TableCell className="py-2 text-right text-sm tabular-nums">
                    {u.quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
