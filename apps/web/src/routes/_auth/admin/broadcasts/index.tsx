import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BroadcastDto, BroadcastStatus } from "@workspace/contracts";
import { getCurrentOrg } from "@/lib/org";
import { canManageEvents } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/components/access-denied";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sendBroadcast } from "@/lib/broadcasts";
import { broadcastKeys, broadcastsQueryOptions } from "@/queries/broadcasts";
import { eventsQueryOptions } from "@/queries/events";
import { pageHead } from "@/lib/seo";
import { BroadcastComposer } from "../~components/broadcasts/broadcast-composer";

export const Route = createFileRoute("/_auth/admin/broadcasts/")({
  component: BroadcastsPage,
  head: () => pageHead("Broadcasts"),
  loader: ({ context }) => context.queryClient.ensureQueryData(broadcastsQueryOptions),
});

const STATUS_VARIANT: Record<BroadcastStatus, "success" | "destructive" | "outline" | "secondary"> =
  {
    sent: "success",
    failed: "destructive",
    sending: "secondary",
    draft: "outline",
  };

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function BroadcastsPage() {
  const orgContext = Route.useRouteContext() as Awaited<ReturnType<typeof getCurrentOrg>>;
  const [composeOpen, setComposeOpen] = useState(false);

  if (!canManageEvents(orgContext.memberRole)) {
    return (
      <AppShell title="Broadcasts" description="Send newsletters and invitations.">
        <div className="mx-auto max-w-md">
          <AccessDenied message="Managers and above can send broadcasts." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Broadcasts"
      description="Send newsletters and invitations to your attendees."
      headerActions={<Button onClick={() => setComposeOpen(true)}>New broadcast</Button>}
    >
      <div className="mx-auto max-w-6xl">
        <HistoryTab onCompose={() => setComposeOpen(true)} />
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 md:max-w-[44rem] lg:max-w-[68rem] xl:max-w-[96rem] max-md:h-dvh max-md:max-h-dvh max-md:max-w-none max-md:rounded-none">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>New broadcast</DialogTitle>
            <DialogDescription>
              Compose a newsletter or invitation. Save it as a draft, then send it from the list.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <BroadcastComposer onCreated={() => setComposeOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function HistoryTab({ onCompose }: { onCompose: () => void }) {
  const queryClient = useQueryClient();
  const broadcastsQuery = useQuery(broadcastsQueryOptions);
  const eventsQuery = useQuery(eventsQueryOptions);
  const broadcasts = broadcastsQuery.data?.broadcasts ?? [];
  const eventTitles = new Map((eventsQuery.data?.events ?? []).map((e) => [e.id, e.title]));

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendBroadcast(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: broadcastKeys.all }),
  });

  function audienceLabel(broadcast: BroadcastDto): string {
    if (broadcast.audience.type === "calendar_subscribers") return "Calendar subscribers";
    return eventTitles.get(broadcast.audience.eventId) ?? "Event guests";
  }

  if (broadcasts.length === 0) {
    return (
      <EmptyState
        title="No broadcasts yet"
        description="Newsletters and invitations you send will show here, with who they reached."
        action={<Button onClick={onCompose}>Compose a broadcast</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {sendMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Could not send. You may be over your weekly send limit, or the audience has no
            recipients. Raise your limit under Settings → Email.
          </AlertDescription>
        </Alert>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sent to</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Reached</TableHead>
            <TableHead className="text-right">When</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {broadcasts.map((broadcast) => (
            <TableRow key={broadcast.id}>
              <TableCell className="max-w-[16rem] truncate font-medium" title={broadcast.subject}>
                {broadcast.subject}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">{broadcast.kind}</TableCell>
              <TableCell className="text-muted-foreground">{audienceLabel(broadcast)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[broadcast.status]} className="text-xs">
                  {broadcast.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {broadcast.status === "sent"
                  ? `${broadcast.sentCount}/${broadcast.recipientCount}`
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {dateFmt.format(new Date(broadcast.sentAt ?? broadcast.createdAt))}
              </TableCell>
              <TableCell className="text-right">
                {broadcast.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() => sendMutation.mutate(broadcast.id)}
                    disabled={sendMutation.isPending}
                  >
                    Send
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
