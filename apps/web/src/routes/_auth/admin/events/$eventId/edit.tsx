import { createFileRoute } from "@tanstack/react-router";
import { getCurrentOrg } from "@/lib/org";
import { eventQueryOptions } from "@/queries/events";
import { pageHead } from "@/lib/seo";
import { EventDetailPage } from "../~components/event-detail-page";

export const Route = createFileRoute("/_auth/admin/events/$eventId/edit")({
  component: EventEditRoute,
  head: () => pageHead("Edit event"),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(eventQueryOptions(params.eventId)),
});

function EventEditRoute() {
  const { eventId } = Route.useParams();
  const orgContext = Route.useRouteContext() as Awaited<ReturnType<typeof getCurrentOrg>>;
  return <EventDetailPage eventId={eventId} orgContext={orgContext} />;
}
