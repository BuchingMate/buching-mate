import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCurrentOrg } from "@/lib/org";
import {
  AppShell,
  PageBackButton,
  PageBreadcrumb,
  PageBreadcrumbCurrent,
  PageBreadcrumbSeparator,
} from "@/components/app-shell";
import { eventToForm } from "@/lib/events";
import { eventQueryOptions } from "@/queries/events";
import { eventRegistrationsQueryOptions } from "@/queries/registrations";
import { attendeesQueryOptions } from "@/queries/attendees";
import { eventResourcesQueryOptions, resourcesQueryOptions } from "@/queries/resources";
import { canDeleteEvents, canManageEvents } from "@/lib/permissions";
import { getOrgPublicUrl } from "@/lib/public";
import { useUpdateEvent } from "@/hooks/use-events";
import { useReplaceEventResources } from "@/hooks/use-resources";
import { RegistrationsTable } from "./registrations-table";
import { RegistrationSummary } from "./registration-summary";
import { EventResourcesTab } from "./event-resources-tab";
import { AddRegistrationDialog } from "./event-detail/add-registration-dialog";
import { EventDetailsForm } from "./event-detail/event-details-form";
import { EventHeaderActions } from "./event-detail/event-header-actions";
import { useEventDetailsForm } from "./event-detail/use-event-details-form";

export function EventDetailPage({
  eventId,
  orgContext,
}: {
  eventId: string;
  orgContext: Awaited<ReturnType<typeof getCurrentOrg>>;
}) {
  const canManage = canManageEvents(orgContext.memberRole);
  const canDelete = canDeleteEvents(orgContext.memberRole);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [addRegOpen, setAddRegOpen] = useState(false);

  const {
    data: { event },
  } = useSuspenseQuery(eventQueryOptions(eventId));

  const { data: registrationsData, isPending: registrationsLoading } = useQuery({
    ...eventRegistrationsQueryOptions(eventId),
    enabled: activeTab === "registrations",
  });

  const { data: eventResourcesData } = useQuery(eventResourcesQueryOptions(eventId));
  const { data: resourcesData, refetch: refetchResources } = useQuery(
    resourcesQueryOptions({ includeArchived: true }),
  );
  const { data: attendeesData } = useQuery({
    ...attendeesQueryOptions(),
    enabled: activeTab === "registrations",
  });

  const saveMutation = useUpdateEvent(eventId);
  const replaceResourcesMutation = useReplaceEventResources(eventId);

  const form = useEventDetailsForm({ event, saveMutation, onError: setError });

  useEffect(() => {
    form.reset(eventToForm(event));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const allResources = resourcesData?.resources ?? [];
  const assignedResources = eventResourcesData?.resources ?? [];
  const resourceById = new Map(allResources.map((r) => [r.id, r]));
  const orgSlug = orgContext.org.slug;
  const publicEventUrl = orgSlug ? getOrgPublicUrl(orgSlug, `/events/${event.id}`) : null;
  const registrations = registrationsData?.registrations ?? [];
  const attendees = attendeesData?.attendees ?? [];

  return (
    <AppShell
      title={
        <PageBreadcrumb>
          <PageBackButton to="/admin/events" label="Back to events" />
          <Link to="/admin/events" className="shrink-0 hover:underline">
            Events
          </Link>
          <PageBreadcrumbSeparator />
          <PageBreadcrumbCurrent>{event?.title ?? "Event"}</PageBreadcrumbCurrent>
        </PageBreadcrumb>
      }
      description={event?.title ?? "Update event details."}
      headerActions={
        <EventHeaderActions
          eventId={eventId}
          canManage={canManage}
          canDelete={canDelete}
          publicEventUrl={publicEventUrl}
          visibility={event.visibility}
          form={form}
          saveMutation={saveMutation}
          onError={setError}
        />
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {!canManage && (
          <Alert>
            <AlertDescription>
              Your viewer role can read this event but cannot edit it.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {event.visibility !== "published" && (
          <Alert>
            <AlertDescription>
              Publish this event to make it visible on your public booking page.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-fit">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="registrations">
              Registrations {registrations.length > 0 && `(${registrations.length})`}
            </TabsTrigger>
            <TabsTrigger value="resources">
              Resources {assignedResources.length > 0 && `(${assignedResources.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6 space-y-4">
            <EventDetailsForm
              eventId={eventId}
              detailImages={event.detailImages}
              form={form}
              canManage={canManage}
              onError={setError}
            />
          </TabsContent>

          <TabsContent value="registrations" className="mt-6">
            {canManage && (
              <AddRegistrationDialog
                eventId={eventId}
                attendees={attendees}
                open={addRegOpen}
                onOpenChange={setAddRegOpen}
                onError={setError}
              />
            )}
            {registrationsLoading ? (
              <p className="text-muted-foreground">Loading registrations...</p>
            ) : registrations.length === 0 ? (
              <div className="space-y-4">
                <RegistrationSummary event={event} registrations={registrations} />
                <EmptyState
                  size="compact"
                  title="No registrations yet"
                  description="Registrations will appear here when attendees sign up."
                  action={
                    canManage && (
                      <Button className="gap-1" onClick={() => setAddRegOpen(true)}>
                        <Plus className="size-3.5" />
                        Add
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                <RegistrationSummary event={event} registrations={registrations} />
                <RegistrationsTable
                  eventId={eventId}
                  eventTitle={event.title}
                  registrations={registrations}
                  canManage={canManage}
                  canDelete={canDelete}
                  onAddClick={() => setAddRegOpen(true)}
                  onError={setError}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="resources" className="mt-6">
            <EventResourcesTab
              canManage={canManage}
              allResources={allResources}
              assignedResources={assignedResources}
              resourceById={resourceById}
              replaceResourcesMutation={replaceResourcesMutation}
              refetchResources={refetchResources}
              onError={setError}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
