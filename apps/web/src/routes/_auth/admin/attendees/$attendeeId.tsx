import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  AppShell,
  PageBackButton,
  PageBreadcrumb,
  PageBreadcrumbCurrent,
  PageBreadcrumbSeparator,
} from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { attendeeQueryOptions, attendeeRegistrationsQueryOptions } from "@/queries/attendees";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_auth/admin/attendees/$attendeeId")({
  component: AttendeeDetailRoute,
  head: () => pageHead("Attendee"),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(attendeeQueryOptions(params.attendeeId)),
      context.queryClient.ensureQueryData(attendeeRegistrationsQueryOptions(params.attendeeId)),
    ]),
});

function AttendeeDetailRoute() {
  const { attendeeId } = Route.useParams();

  const {
    data: { attendee },
  } = useSuspenseQuery(attendeeQueryOptions(attendeeId));

  const {
    data: { registrations },
  } = useSuspenseQuery(attendeeRegistrationsQueryOptions(attendeeId));

  const today = new Date().toISOString().slice(0, 10);

  const { upcoming, past } = useMemo(() => {
    const upcoming: typeof registrations = [];
    const past: typeof registrations = [];
    for (const r of registrations) {
      if (r.event.date >= today) upcoming.push(r);
      else past.push(r);
    }
    upcoming.sort((a, b) => a.event.date.localeCompare(b.event.date));
    past.sort((a, b) => b.event.date.localeCompare(a.event.date));
    return { upcoming, past };
  }, [registrations, today]);

  return (
    <AppShell
      title={
        <PageBreadcrumb>
          <PageBackButton to="/admin/attendees" label="Back to attendees" />
          <Link to="/admin/attendees" className="shrink-0 hover:underline">
            Attendees
          </Link>
          <PageBreadcrumbSeparator />
          <PageBreadcrumbCurrent>{attendee.name}</PageBreadcrumbCurrent>
        </PageBreadcrumb>
      }
      description={attendee.email}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border bg-background p-5 shadow-xs">
          <h2 className="text-base font-semibold tracking-tight">Contact</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd>{attendee.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd>{attendee.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd>{attendee.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Added</dt>
              <dd>{attendee.createdAt.slice(0, 10)}</dd>
            </div>
          </dl>
        </section>

        <RegistrationsSection
          title="Upcoming"
          registrations={upcoming}
          emptyText="No upcoming registrations."
        />
        <RegistrationsSection
          title="Past"
          registrations={past}
          emptyText="No past registrations."
        />
      </div>
    </AppShell>
  );
}

function RegistrationsSection({
  title,
  registrations,
  emptyText,
}: {
  title: string;
  registrations: Array<{
    id: string;
    status: "pending" | "confirmed" | "waitlisted" | "cancelled";
    paymentStatus: string;
    event: {
      id: string;
      title: string;
      date: string;
      time: string;
      status: string;
    };
  }>;
  emptyText: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-muted-foreground">{registrations.length}</span>
      </div>
      {registrations.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="py-2 text-sm font-medium">
                    <Link
                      to="/admin/events/$eventId/edit"
                      params={{ eventId: r.event.id }}
                      className="underline-offset-4 hover:underline"
                    >
                      {r.event.title}
                    </Link>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {r.event.date}
                    <span className="text-muted-foreground/60"> · {r.event.time}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <RegistrationStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {r.paymentStatus.replace("_", " ")}
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

function RegistrationStatusBadge({
  status,
}: {
  status: "pending" | "confirmed" | "waitlisted" | "cancelled";
}) {
  const variant: Record<typeof status, "default" | "secondary" | "outline" | "success"> = {
    pending: "secondary",
    confirmed: "success",
    waitlisted: "secondary",
    cancelled: "outline",
  };
  return (
    <Badge variant={variant[status]} className="capitalize">
      {status}
    </Badge>
  );
}
