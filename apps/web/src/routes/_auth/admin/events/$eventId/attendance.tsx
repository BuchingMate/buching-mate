import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getHostStartUrl } from "@/lib/video";
import {
  importRegistrations,
  parseAttendeeCsv,
  type ImportOutcome,
} from "@/lib/import-registrations";
import { attendanceKeys } from "@/queries/attendance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pageHead } from "@/lib/seo";
import { eventAttendanceQueryOptions } from "@/queries/attendance";

export const Route = createFileRoute("/_auth/admin/events/$eventId/attendance")({
  component: AttendanceRoute,
  head: () => pageHead("Attendance"),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(eventAttendanceQueryOptions(params.eventId)),
});

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function statusBadge(status: string) {
  switch (status) {
    case "attended":
      return <Badge variant="success">attended</Badge>;
    case "no_show":
      return <Badge variant="destructive">no show</Badge>;
    case "cancelled":
      return <Badge variant="outline">cancelled</Badge>;
    default:
      return <Badge variant="outline">registered</Badge>;
  }
}

function AttendanceRoute() {
  const { eventId } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery(eventAttendanceQueryOptions(eventId));
  const rows = query.data?.attendance ?? [];
  const [importResult, setImportResult] = useState<ImportOutcome | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startMutation = useMutation({
    mutationFn: () => getHostStartUrl(eventId),
    onSuccess: (data) => window.open(data.url, "_blank", "noopener"),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const parsed = parseAttendeeCsv(text);
      if (parsed.length === 0) throw new Error("No rows found. CSV must have name,email columns.");
      return importRegistrations(eventId, parsed);
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: attendanceKeys.event(eventId) });
    },
  });

  return (
    <AppShell
      title="Attendance"
      description="Who joined and how long they stayed. Populated after the Zoom meeting ends."
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex justify-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importMutation.mutate(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? "Importing…" : "Import CSV"}
          </Button>
          <Button
            size="sm"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            Start meeting
          </Button>
        </div>
        {importResult ? (
          <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
            Imported {importResult.created} new · skipped {importResult.skipped} · failed{" "}
            {importResult.failed}
            {importResult.errors.length > 0 ? (
              <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                {importResult.errors.slice(0, 5).map((err) => (
                  <li key={`${err.row}-${err.email}`}>
                    Row {err.row} ({err.email}): {err.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {importMutation.isError ? (
          <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {(importMutation.error as Error).message}
          </div>
        ) : null}
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No registrations yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Left</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.registrationId}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDuration(row.durationSeconds)}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs text-muted-foreground">
                    {row.joinTime ? new Date(row.joinTime).toLocaleTimeString() : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs text-muted-foreground">
                    {row.leaveTime ? new Date(row.leaveTime).toLocaleTimeString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.device ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppShell>
  );
}

