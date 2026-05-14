/* eslint-disable react/no-children-prop */
import { useForm } from "@tanstack/react-form";
import type { ResourceDto, ResourceType } from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateResource, useUpdateResource } from "@/hooks/use-resources";
import {
  emptyResourceForm,
  formToResourceRequest,
  resourceFormSchema,
  resourceToForm,
} from "@/lib/resource-form";
import { ResourceFormFields } from "./resource-form-fields";

export function CreateResourceDialog({
  open,
  onOpenChange,
  defaultType,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType: ResourceType;
  onError: (message: string) => void;
}) {
  const createMutation = useCreateResource();

  const form = useForm({
    defaultValues: emptyResourceForm(defaultType),
    validators: {
      onChange: resourceFormSchema,
      onSubmit: resourceFormSchema,
    },
    onSubmit: ({ value, formApi }) => {
      createMutation.mutate(formToResourceRequest(value), {
        onSuccess: () => {
          formApi.reset(emptyResourceForm(defaultType));
          onOpenChange(false);
        },
        onError: (error) =>
          onError(error instanceof Error ? error.message : "Unable to create resource"),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New resource</DialogTitle>
          <DialogDescription>
            Add a person, space, or item your team assigns to events.
          </DialogDescription>
        </DialogHeader>
        <ResourceFormFields form={form} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
            children={([canSubmit, isSubmitting]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || createMutation.isPending}
              >
                {isSubmitting || createMutation.isPending ? "Saving..." : "Add resource"}
              </Button>
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditResourceDialog({
  resource,
  onClose,
  onError,
}: {
  resource: ResourceDto;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const updateMutation = useUpdateResource(resource.id);

  const form = useForm({
    defaultValues: resourceToForm(resource),
    validators: {
      onChange: resourceFormSchema,
      onSubmit: resourceFormSchema,
    },
    onSubmit: ({ value }) => {
      updateMutation.mutate(formToResourceRequest(value), {
        onSuccess: () => onClose(),
        onError: (error) =>
          onError(error instanceof Error ? error.message : "Unable to update resource"),
      });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit resource</DialogTitle>
          <DialogDescription>Update resource details.</DialogDescription>
        </DialogHeader>
        <ResourceFormFields form={form} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine] as const}
            children={([canSubmit, isSubmitting, isPristine]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || isPristine || updateMutation.isPending}
              >
                {isSubmitting || updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
