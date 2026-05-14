import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2, Wrench } from "lucide-react";
import type { EventResourceDto, ResourceDto } from "@workspace/contracts";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useReplaceEventResources } from "@/hooks/use-resources";

type ReplaceMutation = ReturnType<typeof useReplaceEventResources>;

interface DraftAssignment {
  resourceId: string;
  role: string;
  quantity: number;
}

export function EventResourcesTab({
  canManage,
  allResources,
  assignedResources,
  resourceById,
  replaceResourcesMutation,
  refetchResources,
  onError,
}: {
  canManage: boolean;
  allResources: ResourceDto[];
  assignedResources: EventResourceDto[];
  resourceById: Map<string, ResourceDto>;
  replaceResourcesMutation: ReplaceMutation;
  refetchResources: () => void;
  onError: (message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const openDialog = () => {
    refetchResources();
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Assigned resources</h2>
        {canManage && assignedResources.length > 0 && (
          <Button variant="outline" size="sm" onClick={openDialog}>
            <Pencil className="size-3.5" />
            Edit resources
          </Button>
        )}
      </div>

      {assignedResources.length === 0 ? (
        <ResourcesEmpty canManage={canManage} onAssign={openDialog} />
      ) : (
        <AssignmentList assignedResources={assignedResources} resourceById={resourceById} />
      )}

      {dialogOpen && (
        <AssignResourcesDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          allResources={allResources}
          assignedResources={assignedResources}
          resourceById={resourceById}
          replaceResourcesMutation={replaceResourcesMutation}
          onError={onError}
        />
      )}
    </div>
  );
}

function ResourcesEmpty({ canManage, onAssign }: { canManage: boolean; onAssign: () => void }) {
  return (
    <EmptyState
      icon={<Wrench className="size-8" />}
      title="No resources assigned"
      description="Assign instructors, locations, materials, and equipment to this event."
      action={
        canManage && (
          <Button variant="outline" size="sm" onClick={onAssign}>
            <Plus className="size-3.5" />
            Assign resources
          </Button>
        )
      }
    />
  );
}

function AssignmentList({
  assignedResources,
  resourceById,
}: {
  assignedResources: EventResourceDto[];
  resourceById: Map<string, ResourceDto>;
}) {
  return (
    <div className="space-y-3">
      {assignedResources.map((assignment) => {
        const resource = resourceById.get(assignment.resourceId);
        return (
          <div
            key={assignment.id}
            className="flex items-center justify-between rounded-lg border bg-background/90 p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          >
            <div>
              <p className="font-medium">
                {resource?.name ?? "Unknown resource"}
                {resource?.archivedAt && (
                  <span className="ml-2 text-xs text-muted-foreground">archived</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {assignment.role} · {resource?.type ?? "unknown"}
                {assignment.quantity > 1 && ` · qty ${assignment.quantity}`}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">
              {resource?.type ?? "unknown"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AssignResourcesDialog({
  open,
  onClose,
  allResources,
  assignedResources,
  resourceById,
  replaceResourcesMutation,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  allResources: ResourceDto[];
  assignedResources: EventResourceDto[];
  resourceById: Map<string, ResourceDto>;
  replaceResourcesMutation: ReplaceMutation;
  onError: (message: string) => void;
}) {
  const [drafts, setDrafts] = useState<DraftAssignment[]>(() =>
    assignedResources.map((ar) => ({
      resourceId: ar.resourceId,
      role: ar.role,
      quantity: ar.quantity,
    })),
  );

  const orgHasNonArchivedResources = allResources.some((r) => !r.archivedAt);

  const handleSave = () => {
    const valid = drafts.filter((a) => a.resourceId && a.role.trim());
    replaceResourcesMutation.mutate(
      {
        resources: valid.map((a) => ({
          resourceId: a.resourceId,
          role: a.role.trim(),
          quantity: a.quantity > 0 ? a.quantity : 1,
        })),
      },
      {
        onSuccess: () => onClose(),
        onError: (error) =>
          onError(error instanceof Error ? error.message : "Unable to update resources"),
      },
    );
  };

  const addRow = () => setDrafts((prev) => [...prev, { resourceId: "", role: "", quantity: 1 }]);

  const updateRow = (index: number, field: keyof DraftAssignment, value: string | number) => {
    setDrafts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (field === "quantity") {
        next[index] = {
          ...current,
          quantity: typeof value === "string" ? parseInt(value) || 1 : (value as number),
        };
      } else {
        next[index] = { ...current, [field]: value as string };
      }
      return next;
    });
  };

  const removeRow = (index: number) => setDrafts((prev) => prev.filter((_, i) => i !== index));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {assignedResources.length === 0 ? "Assign resources" : "Edit resources"}
          </DialogTitle>
          <DialogDescription>
            Pick instructors, locations, materials, and equipment for this event. Set a role and
            quantity per assignment.
          </DialogDescription>
        </DialogHeader>

        {!orgHasNonArchivedResources && (
          <Alert>
            <AlertDescription>
              No resources exist yet. Create one in{" "}
              <Link to="/admin/resources" className="underline underline-offset-4">
                Resources
              </Link>{" "}
              before assigning.
            </AlertDescription>
          </Alert>
        )}

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {drafts.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No assignments yet. Click &ldquo;Add resource&rdquo; below to start.
            </p>
          ) : (
            drafts.map((draft, index) => (
              <DraftRow
                key={index}
                draft={draft}
                drafts={drafts}
                resourceById={resourceById}
                allResources={allResources}
                onUpdate={(field, value) => updateRow(index, field, value)}
                onRemove={() => removeRow(index)}
              />
            ))
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-full"
            disabled={!orgHasNonArchivedResources}
          >
            <Plus className="size-3.5" />
            Add resource
          </Button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={replaceResourcesMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={replaceResourcesMutation.isPending}>
            {replaceResourcesMutation.isPending ? "Saving..." : "Save resources"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftRow({
  draft,
  drafts,
  resourceById,
  allResources,
  onUpdate,
  onRemove,
}: {
  draft: DraftAssignment;
  drafts: DraftAssignment[];
  resourceById: Map<string, ResourceDto>;
  allResources: ResourceDto[];
  onUpdate: (field: keyof DraftAssignment, value: string | number) => void;
  onRemove: () => void;
}) {
  const resource = resourceById.get(draft.resourceId);
  const unassigned = allResources.filter(
    (r) => !r.archivedAt && r.id !== draft.resourceId && !drafts.some((d) => d.resourceId === r.id),
  );

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
      <div className="flex-1 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Resource</Label>
          <Select
            value={draft.resourceId ?? ""}
            onValueChange={(value) => onUpdate("resourceId", value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a resource" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {resource && (
                <SelectItem value={resource.id}>
                  {resource.name} ({resource.type}){resource.archivedAt ? " · archived" : ""}
                </SelectItem>
              )}
              {unassigned.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Input
              value={draft.role}
              onChange={(e) => onUpdate("role", e.target.value)}
              placeholder="e.g., instructor, location"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quantity</Label>
            <Input
              type="number"
              min="1"
              value={draft.quantity}
              onChange={(e) => onUpdate("quantity", e.target.value)}
            />
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label="Remove assignment"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
