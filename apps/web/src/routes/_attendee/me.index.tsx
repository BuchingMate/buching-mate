import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { cancelMyRegistration, listMyRegistrations } from "@/lib/public";
import { attendeeAuthClient } from "@/lib/attendee-auth-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authKeys } from "@/queries/auth";
import { pageHead } from "@/lib/seo";

const myRegistrationsQuery = queryOptions({
  queryKey: ["public", "me", "registrations"] as const,
  queryFn: () => listMyRegistrations(),
  staleTime: 1000 * 30,
});

export const Route = createFileRoute("/_attendee/me/")({
  component: MePage,
  head: () => pageHead("My registrations"),
});

function MePage() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(myRegistrationsQuery);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelMyRegistration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myRegistrationsQuery.queryKey }),
  });

  const handleSignOut = async () => {
    await attendeeAuthClient.signOut();
    queryClient.removeQueries({ queryKey: authKeys.attendeeSession });
    window.location.href = "/events";
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold uppercase tracking-tight">
          My registrations
        </h1>
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>

      {isPending ? <p className="text-muted-foreground">Loading…</p> : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>Failed to load registrations.</AlertDescription>
        </Alert>
      ) : null}

      {data && data.registrations.length === 0 ? (
        <Alert>
          <AlertDescription>No registrations yet.</AlertDescription>
        </Alert>
      ) : null}

      <ul className="space-y-3">
        {data?.registrations.map((item) => {
          const cancelled = item.registration.status === "cancelled";
          return (
            <li
              key={item.registration.id}
              className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.org.name}
                </div>
                <div className="truncate font-heading text-lg font-semibold">
                  {item.event.title}
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.event.date} · {item.event.time}
                  {item.event.location ? ` · ${item.event.location}` : ""}
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {item.registration.status} · {item.registration.paymentStatus}
                </div>
              </div>
              {!cancelled ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(item.registration.id)}
                >
                  Cancel
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
