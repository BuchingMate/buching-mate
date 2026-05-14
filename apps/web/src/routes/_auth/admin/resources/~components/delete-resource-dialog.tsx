import type { ResourceDto } from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteResource } from "@/hooks/use-resources";

export function DeleteResourceDialog({
  resource,
  onClose,
  onDeleted,
  onError,
}: {
  resource: ResourceDto;
  onClose: () => void;
  onDeleted?: () => void;
  onError: (message: string) => void;
}) {
  const deleteMutation = useDeleteResource();

  const handleDelete = () => {
    deleteMutation.mutate(resource.id, {
      onSuccess: () => {
        onDeleted?.();
        onClose();
      },
      onError: (error) =>
        onError(error instanceof Error ? error.message : "Unable to delete resource"),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete resource?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{resource.name}</span> will be removed. If
            it&apos;s assigned to events, deletion will fail — archive it instead to preserve
            history.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
