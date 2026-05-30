import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AppShell,
  PageBackButton,
  PageBreadcrumb,
  PageBreadcrumbCurrent,
  PageBreadcrumbSeparator,
} from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { pageHead } from "@/lib/seo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formToEventRequest, type EventFormState } from "@/lib/events";
import { getCurrentOrg } from "@/lib/org";
import { canManageEvents } from "@/lib/permissions";
import { eventKeys } from "@/queries/events";
import { orgMembersQueryOptions } from "@/queries/org";
import { resourcesQueryOptions } from "@/queries/resources";
import { useCreateEvent } from "@/hooks/use-events";
import { useOrgCurrency } from "@/hooks/use-org";
import { uploadPublicAsset } from "@/lib/assets";
import { replaceEventResources } from "@/lib/resources";
import { EventCreateForm } from "./~components/event-create-form";
import { useEventCreateForm } from "./~components/use-event-create-form";
import { useEventLocationContext } from "./~components/use-event-location-context";
import type { ResourceAssignmentDraft } from "./~components/event-form-parts";

export const Route = createFileRoute("/_auth/admin/events/new")({
  component: NewEvent,
  head: () => pageHead("New event"),
});

function NewEvent() {
  const orgContext = Route.useRouteContext() as Awaited<ReturnType<typeof getCurrentOrg>>;
  const canManage = canManageEvents(orgContext.memberRole);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currency = useOrgCurrency();
  const createMutation = useCreateEvent();

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);
  const [resourceAssignments, setResourceAssignments] = useState<ResourceAssignmentDraft[]>([]);
  const [error, setError] = useState("");

  const { data: resourcesData } = useQuery(resourcesQueryOptions({ includeArchived: true }));
  const { data: membersData } = useQuery(orgMembersQueryOptions);
  const { recentLocations, zoomConnected, connectZoom } = useEventLocationContext({
    orgSlug: orgContext.org.slug,
  });

  // Keep the submit handler fresh so the form's onSubmit closure reads current
  // file/resource state (not the values captured when useForm was created).
  const submitRef = useRef<(value: EventFormState) => Promise<void>>(async () => {});
  submitRef.current = async (value: EventFormState) => {
    setError("");
    try {
      const { event: created } = await createMutation.mutateAsync(
        formToEventRequest(value, currency),
      );
      const assignments = resourceAssignments.filter((a) => a.resourceId && a.role.trim());
      if (assignments.length > 0) {
        await replaceEventResources(created.id, {
          resources: assignments.map((a) => ({
            resourceId: a.resourceId,
            role: a.role.trim(),
            quantity: a.quantity > 0 ? a.quantity : 1,
          })),
        });
      }
      const uploads: { file: File; role: "cover" | "detail" }[] = [
        ...(coverFile ? [{ file: coverFile, role: "cover" as const }] : []),
        ...detailFiles.map((file) => ({ file, role: "detail" as const })),
      ];
      const uploadErrors: string[] = [];
      for (const { file, role } of uploads) {
        try {
          await uploadPublicAsset({ file, kind: "event_image", role, eventId: created.id });
        } catch (err) {
          uploadErrors.push(err instanceof Error ? err.message : `Unable to upload ${file.name}`);
        }
      }
      if (created.video?.provider === "zoom") {
        toast.success("Zoom meeting created", { description: created.video.joinUrl });
      }
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      navigate({ to: "/admin/events/$eventId/edit", params: { eventId: created.id } });
    } catch (err) {
      if (err instanceof ApiError && err.code === "event_cap_exceeded") {
        toast.warning("Free plan limit reached", {
          description: "Upgrade to Team for unlimited events.",
        });
      } else {
        setError(err instanceof Error ? err.message : "Unable to create event");
      }
    }
  };

  const form = useEventCreateForm((value) => submitRef.current(value));

  return (
    <AppShell
      title={
        <PageBreadcrumb>
          <PageBackButton to="/admin/events" label="Back to events" />
          <Link to="/admin/events" className="shrink-0 hover:underline">
            Events
          </Link>
          <PageBreadcrumbSeparator />
          <PageBreadcrumbCurrent>New event</PageBreadcrumbCurrent>
        </PageBreadcrumb>
      }
      description="Create a new event."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {!canManage && (
          <Alert>
            <AlertDescription>Your role can't create events.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <EventCreateForm
          form={form}
          canManage={canManage}
          resources={resourcesData?.resources ?? []}
          resourceAssignments={resourceAssignments}
          onResourceAssignmentsChange={setResourceAssignments}
          coverFile={coverFile}
          detailFiles={detailFiles}
          onCoverFileChange={setCoverFile}
          onDetailFilesChange={setDetailFiles}
          members={membersData?.members ?? []}
          recentLocations={recentLocations}
          zoomConnected={zoomConnected}
          onConnectZoom={connectZoom}
        />
      </div>
    </AppShell>
  );
}
