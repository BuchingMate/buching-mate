import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { pageHead } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eventsQueryOptions } from "@/queries/events";

export const Route = createFileRoute("/_auth/admin/")({
  component: Index,
  head: () => pageHead("Dashboard"),
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQueryOptions),
});

function Index() {
  const {
    data: { events },
  } = useSuspenseQuery(eventsQueryOptions);
  const upcoming = events
    .filter((event) => event.status === "upcoming" && event.archivedAt === null)
    .slice(0, 5);

  return (
    <AppShell title="Dashboard" description="Operational overview for your organization.">
      <div className="mx-auto max-w-4xl space-y-10">
        <section className="space-y-6">
          <div>
            <CardHeader className="flex flex-col gap-4 px-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl tracking-tight">Upcoming events</CardTitle>
                <CardDescription>Recent schedule items from your event workspace.</CardDescription>
              </div>
              <Link to="/admin/events">
                <Button>Manage events</Button>
              </Link>
            </CardHeader>
            <CardContent className="px-0">
              {upcoming.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
                  <h2 className="text-lg font-semibold tracking-tight">Create your first event</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Events are managed from the Events workspace.
                  </p>
                  <Link to="/admin/events" className="mt-4 inline-flex">
                    <Button variant="outline">Open events</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((event) => (
                    <Link
                      key={event.id}
                      to="/admin/events/$eventId/edit"
                      params={{ eventId: event.id }}
                      className="block rounded-xl bg-muted/40 p-4 transition-colors hover:bg-muted"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold tracking-tight">{event.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {event.date} at {event.time} · {event.duration} min
                          </p>
                        </div>
                        <span className="rounded-full border bg-secondary px-2 py-1 text-xs font-medium">
                          {event.visibility}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </div>
        </section>

        <aside className="border-t pt-6">
          <div className="grid gap-6 sm:grid-cols-[12rem_12rem_minmax(0,1fr)]">
            <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Event loop
            </p>
            <div>
              <p className="text-4xl font-semibold tracking-[-0.06em]">{events.length}</p>
              <p className="text-muted-foreground">Total events</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tracking-[-0.06em]">{upcoming.length}</p>
              <p className="text-muted-foreground">Upcoming events shown</p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground sm:col-span-3">
              Use Events for filters, table sorting, kanban status changes, and duplication.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
