import { useMemo, useState } from "react";
import {
  ArrowUpCircle,
  ArrowUpDown,
  Ban,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { PaymentStatus, RegistrationWithAttendeeDto } from "@workspace/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleteRegistration, useUpdateRegistration } from "@/hooks/use-registrations";
import { PaymentStatusSelect } from "./registration-summary";
import { RegistrationDetailSheet } from "./registration-detail-sheet";
import { useConfirm } from "./confirm-dialog";

type RegStatus = RegistrationWithAttendeeDto["status"];
type SortKey = "name" | "status" | "payment" | "registeredAt";
type SortDir = "asc" | "desc";

const statusVariant: Record<RegStatus, "default" | "secondary" | "outline" | "success"> = {
  pending: "secondary",
  confirmed: "success",
  waitlisted: "secondary",
  cancelled: "outline",
};

const paymentVariant: Record<
  PaymentStatus,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  not_required: "outline",
  pending: "secondary",
  paid: "success",
  refunded: "outline",
  expired: "outline",
  failed: "destructive",
};

function paymentLabel(status: PaymentStatus): string {
  if (status === "not_required") return "not required";
  return status;
}

const STATUSES: RegStatus[] = ["pending", "confirmed", "waitlisted", "cancelled"];

export function RegistrationsTable({
  eventId,
  eventTitle,
  registrations,
  canManage,
  canDelete,
  onAddClick,
  onError,
}: {
  eventId: string;
  eventTitle: string;
  registrations: RegistrationWithAttendeeDto[];
  canManage: boolean;
  canDelete: boolean;
  onAddClick: () => void;
  onError: (message: string) => void;
}) {
  const updateMutation = useUpdateRegistration(eventId);
  const deleteMutation = useDeleteRegistration(eventId);
  const [confirm, confirmDialog] = useConfirm();

  const [statusFilter, setStatusFilter] = useState<RegStatus | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("registeredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sheetId, setSheetId] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    const counts: Record<RegStatus, number> = {
      pending: 0,
      confirmed: 0,
      waitlisted: 0,
      cancelled: 0,
    };
    for (const r of registrations) counts[r.status] += 1;
    return counts;
  }, [registrations]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = registrations;
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (q) {
      rows = rows.filter(
        (r) =>
          r.attendee.name.toLowerCase().includes(q) || r.attendee.email.toLowerCase().includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => compareReg(a, b, sortKey));
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [registrations, statusFilter, search, sortKey, sortDir]);

  const visibleIds = useMemo(() => visible.map((r) => r.id), [visible]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selectedIds.has(id));
  const selectedRegistrations = registrations.filter((r) => selectedIds.has(r.id));
  const sheetRegistration = registrations.find((r) => r.id === sheetId) ?? null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "registeredAt" ? "desc" : "asc");
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...visibleIds]));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateStatus = (id: string, status: RegStatus) => {
    updateMutation.mutate(
      { id, input: { status } },
      {
        onError: (err) =>
          onError(err instanceof Error ? err.message : "Unable to update registration"),
      },
    );
  };

  const updatePayment = (id: string, paymentStatus: PaymentStatus) => {
    updateMutation.mutate(
      { id, input: { paymentStatus } },
      {
        onError: (err) =>
          onError(err instanceof Error ? err.message : "Unable to update registration"),
      },
    );
  };

  const removeRegistration = (id: string) => {
    deleteMutation.mutate(id, {
      onError: (err) =>
        onError(err instanceof Error ? err.message : "Unable to delete registration"),
    });
  };

  const bulkPromote = async () => {
    const ids = selectedRegistrations.filter((r) => r.status === "waitlisted").map((r) => r.id);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        updateMutation.mutateAsync({ id, input: { status: "confirmed" } }).catch((err) => {
          onError(err instanceof Error ? err.message : "Unable to promote registration");
        }),
      ),
    );
    setSelectedIds(new Set());
  };

  const bulkCancel = async () => {
    const ids = selectedRegistrations.filter((r) => r.status !== "cancelled").map((r) => r.id);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Cancel ${ids.length} registration${ids.length === 1 ? "" : "s"}?`,
      description: "Selected registrations will be marked as cancelled.",
      confirmLabel: "Cancel registrations",
      cancelLabel: "Keep",
      destructive: true,
    });
    if (!ok) return;
    await Promise.all(
      ids.map((id) =>
        updateMutation.mutateAsync({ id, input: { status: "cancelled" } }).catch((err) => {
          onError(err instanceof Error ? err.message : "Unable to cancel registration");
        }),
      ),
    );
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Remove ${ids.length} registration${ids.length === 1 ? "" : "s"}?`,
      description: "This permanently removes the selected registrations.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    await Promise.all(
      ids.map((id) =>
        deleteMutation.mutateAsync(id).catch((err) => {
          onError(err instanceof Error ? err.message : "Unable to remove registration");
        }),
      ),
    );
    setSelectedIds(new Set());
  };

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Phone", "Status", "Payment", "Registered At"],
      ...visible.map((r) => [
        r.attendee.name,
        r.attendee.email,
        r.attendee.phone ?? "",
        r.status,
        r.paymentStatus,
        r.createdAt,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(eventTitle) || "event"}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-3">
      {hasSelection ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/20 bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {canManage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={bulkPromote}
                disabled={
                  updateMutation.isPending ||
                  !selectedRegistrations.some((r) => r.status === "waitlisted")
                }
              >
                <ArrowUpCircle className="size-3.5" />
                Promote
              </Button>
            )}
            {canManage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={bulkCancel}
                disabled={
                  updateMutation.isPending ||
                  !selectedRegistrations.some((r) => r.status !== "cancelled")
                }
              >
                <Ban className="size-3.5" />
                Cancel
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                onClick={bulkDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filter:</span>
          {STATUSES.map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(active ? null : s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 capitalize transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                {s}
                <span className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}>
                  {statusCounts[s]}
                </span>
              </button>
            );
          })}
          {statusFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Clear
            </button>
          )}
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={exportCsv}
            disabled={visible.length === 0}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
          {canManage && (
            <Button size="sm" className="h-8 gap-1" onClick={onAddClick}>
              <Plus className="size-3.5" />
              Add
            </Button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 w-10 pl-3">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <SortHead
                label="Attendee"
                k="name"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortHead
                label="Status"
                k="status"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="w-32"
              />
              <SortHead
                label="Payment"
                k="payment"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="w-44"
              />
              <SortHead
                label="Registered"
                k="registeredAt"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="hidden w-36 md:table-cell"
              />
              <TableHead className="h-10 w-56" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {search || statusFilter ? "No matching registrations." : "No registrations."}
                </TableCell>
              </TableRow>
            ) : null}
            {visible.map((registration) => {
              const checked = selectedIds.has(registration.id);
              return (
                <TableRow
                  key={registration.id}
                  className={`hover:bg-muted/40 ${checked ? "bg-muted/30" : ""}`}
                  data-state={checked ? "selected" : undefined}
                >
                  <TableCell className="py-3 pl-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleOne(registration.id)}
                      aria-label={`Select ${registration.attendee.name}`}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <button
                      type="button"
                      onClick={() => setSheetId(registration.id)}
                      className="flex flex-col items-start text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-sm font-medium hover:underline">
                        {registration.attendee.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {registration.attendee.email}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setStatusFilter(
                          statusFilter === registration.status ? null : registration.status,
                        )
                      }
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={`Filter by ${registration.status}`}
                    >
                      <Badge
                        variant={statusVariant[registration.status]}
                        className="capitalize cursor-pointer"
                      >
                        {registration.status}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant={paymentVariant[registration.paymentStatus]}
                      className="capitalize"
                    >
                      {paymentLabel(registration.paymentStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden py-3 text-xs text-muted-foreground md:table-cell">
                    {formatDate(registration.createdAt)}
                  </TableCell>
                  <TableCell className="py-3 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <Popover>
                          <PopoverTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                title="Edit payment status"
                                disabled={updateMutation.isPending}
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </Button>
                            }
                          />
                          <PopoverContent align="end" className="w-56 p-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              Payment status
                            </p>
                            <PaymentStatusSelect
                              value={registration.paymentStatus}
                              onChange={(p) => updatePayment(registration.id, p)}
                              disabled={updateMutation.isPending}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                      {registration.status === "waitlisted" && canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => updateStatus(registration.id, "confirmed")}
                          disabled={updateMutation.isPending}
                          title="Promote to confirmed"
                        >
                          <ArrowUpCircle className="size-3.5" />
                          Promote
                        </Button>
                      )}
                      {registration.status !== "cancelled" && canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Cancel this registration?",
                              description: `${registration.attendee.name} will be marked as cancelled.`,
                              confirmLabel: "Cancel registration",
                              cancelLabel: "Keep",
                              destructive: true,
                            });
                            if (!ok) return;
                            updateStatus(registration.id, "cancelled");
                          }}
                          disabled={updateMutation.isPending}
                          title="Cancel registration"
                        >
                          <Ban className="size-3.5" />
                          Cancel
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Remove this registration?",
                              description: `Remove ${registration.attendee.name} from this event.`,
                              confirmLabel: "Remove",
                              destructive: true,
                            });
                            if (!ok) return;
                            removeRegistration(registration.id);
                          }}
                          disabled={deleteMutation.isPending}
                          aria-label="Remove registration"
                          title="Remove registration"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <RegistrationDetailSheet
        registration={sheetRegistration}
        open={sheetId !== null}
        onOpenChange={(o) => {
          if (!o) setSheetId(null);
        }}
        canManage={canManage}
        canDelete={canDelete}
        onUpdateStatus={updateStatus}
        onUpdatePayment={updatePayment}
        onDelete={removeRegistration}
        confirm={confirm}
      />
      {confirmDialog}
    </div>
  );
}

function SortHead({
  label,
  k,
  sortKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <TableHead className={`h-10 py-0 ${className ?? ""}`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => onSort(k)}
      >
        {label}
        <span className="ml-0.5 opacity-70">
          {active ? dir === "asc" ? "↑" : "↓" : <ArrowUpDown className="size-3" />}
        </span>
      </Button>
    </TableHead>
  );
}

function compareReg(a: RegistrationWithAttendeeDto, b: RegistrationWithAttendeeDto, key: SortKey) {
  if (key === "name") return a.attendee.name.localeCompare(b.attendee.name);
  if (key === "status") return a.status.localeCompare(b.status);
  if (key === "payment") return a.paymentStatus.localeCompare(b.paymentStatus);
  return a.createdAt.localeCompare(b.createdAt);
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
