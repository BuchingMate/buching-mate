import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/admin/events/$eventId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/events/$eventId/edit",
      params: { eventId: params.eventId },
    });
  },
});
