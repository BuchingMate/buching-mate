import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Copy, ExternalLink, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeleteEvent, useDuplicateEvent, type useUpdateEvent } from "@/hooks/use-events";
import type { useEventDetailsForm } from "./use-event-details-form";

type SaveMutation = ReturnType<typeof useUpdateEvent>;
type FormApi = ReturnType<typeof useEventDetailsForm>;

export function EventHeaderActions({
  eventId,
  canManage,
  canDelete,
  publicEventUrl,
  visibility,
  form,
  saveMutation,
  onError,
}: {
  eventId: string;
  canManage: boolean;
  canDelete: boolean;
  publicEventUrl: string | null;
  visibility: "published" | "unpublished";
  form: FormApi;
  saveMutation: SaveMutation;
  onError: (message: string) => void;
}) {
  const navigate = useNavigate();
  const duplicateMutation = useDuplicateEvent();
  const deleteMutation = useDeleteEvent();

  const handleDelete = async () => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    if (!canDelete) return;
    deleteMutation.mutate(eventId, {
      onSuccess: async () => {
        await navigate({ to: "/admin/events" });
      },
      onError: (err) => onError(err instanceof Error ? err.message : "Unable to delete event"),
    });
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <PublicEventActions url={publicEventUrl} visibility={visibility} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                duplicateMutation.mutate(eventId, {
                  onError: (err) =>
                    onError(err instanceof Error ? err.message : "Unable to duplicate event"),
                })
              }
              disabled={!canManage || duplicateMutation.isPending}
              aria-label={duplicateMutation.isPending ? "Duplicating event" : "Duplicate event"}
            />
          }
        >
          <Copy />
        </TooltipTrigger>
        <TooltipContent>
          {duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="destructive"
              size="icon"
              onClick={handleDelete}
              disabled={!canDelete || deleteMutation.isPending}
              aria-label={deleteMutation.isPending ? "Deleting event" : "Delete event"}
            />
          }
        >
          <Trash2 />
        </TooltipTrigger>
        <TooltipContent>{deleteMutation.isPending ? "Deleting..." : "Delete"}</TooltipContent>
      </Tooltip>
      <form.Subscribe
        // eslint-disable-next-line react/no-children-prop
        selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine] as const}
        children={([canSubmit, isSubmitting, isPristine]) => (
          <Button
            type="submit"
            form="event-details-form"
            disabled={
              !canManage || !canSubmit || isSubmitting || isPristine || saveMutation.isPending
            }
          >
            <Save />
            {isSubmitting || saveMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        )}
      />
    </div>
  );
}

function PublicEventActions({
  url,
  visibility,
}: {
  url: string | null;
  visibility: "published" | "unpublished";
}) {
  const [copied, setCopied] = useState(false);
  if (visibility !== "published" || !url) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button variant="outline" render={<a href={url} target="_blank" rel="noreferrer" />}>
        <ExternalLink className="size-4" />
        View public page
      </Button>
      <Button type="button" variant="outline" onClick={copy}>
        <Copy className="size-4" />
        {copied ? "Copied" : "Copy link"}
      </Button>
    </>
  );
}
