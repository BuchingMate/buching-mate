/* eslint-disable react/no-children-prop */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Search, UserPlus, Users } from "lucide-react";
import type { AttendeeDto } from "@workspace/contracts";
import { getCurrentOrg } from "@/lib/org";
import { canManageAttendees } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { pageHead } from "@/lib/seo";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { attendeesQueryOptions } from "@/queries/attendees";
import { useCreateAttendee, useUpdateAttendee } from "@/hooks/use-attendees";
import {
  attendeeFormSchema,
  attendeeToForm,
  emptyAttendeeForm,
  formToAttendeeRequest,
} from "@/lib/attendees";

export const Route = createFileRoute("/_auth/admin/attendees/")({
  component: AttendeesPage,
  head: () => pageHead("Attendees"),
  loader: ({ context }) => context.queryClient.ensureQueryData(attendeesQueryOptions()),
});

function AttendeesPage() {
  const orgContext = Route.useRouteContext() as Awaited<ReturnType<typeof getCurrentOrg>>;
  const canManage = canManageAttendees(orgContext.memberRole);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AttendeeDto | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const {
    data: { attendees },
  } = useSuspenseQuery(attendeesQueryOptions(search || null));

  const sorted = useMemo(
    () => [...attendees].sort((a, b) => a.name.localeCompare(b.name)),
    [attendees],
  );

  return (
    <AppShell
      title="Attendees"
      description="Track people across events and registrations."
      headerActions={
        canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-3.5" />
            Add attendee
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email"
            className="pl-8"
          />
        </div>

        {!canManage && <p className="text-xs text-muted-foreground">Viewer role — read-only</p>}

        {sorted.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" />}
            title={search ? "No matching attendees" : "No attendees yet"}
            description={
              search
                ? "Try a different name or email."
                : "Attendees appear here once they register, or you add them manually."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10">Name</TableHead>
                  <TableHead className="h-10">Email</TableHead>
                  <TableHead className="h-10">Phone</TableHead>
                  <TableHead className="h-10">Added</TableHead>
                  <TableHead className="h-10 w-10" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((attendee) => (
                  <TableRow key={attendee.id} className="hover:bg-muted/40">
                    <TableCell className="py-3 text-sm font-medium">
                      <Link
                        to="/admin/attendees/$attendeeId"
                        params={{ attendeeId: attendee.id }}
                        className="underline-offset-4 hover:underline"
                      >
                        {attendee.name}
                      </Link>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {attendee.email}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                      {attendee.phone ?? "—"}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                      {attendee.createdAt.slice(0, 10)}
                    </TableCell>
                    <TableCell className="py-3 pr-3">
                      <div className="flex items-center justify-end">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditing(attendee)}
                            aria-label={`Edit ${attendee.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateAttendeeDialog open={createOpen} onOpenChange={setCreateOpen} onError={setError} />
      )}

      {editing && (
        <EditAttendeeDialog
          attendee={editing}
          onClose={() => setEditing(null)}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

function CreateAttendeeDialog({
  open,
  onOpenChange,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (message: string) => void;
}) {
  const createMutation = useCreateAttendee();

  const form = useForm({
    defaultValues: emptyAttendeeForm,
    validators: {
      onChange: attendeeFormSchema,
      onSubmit: attendeeFormSchema,
    },
    onSubmit: ({ value, formApi }) => {
      createMutation.mutate(formToAttendeeRequest(value), {
        onSuccess: () => {
          formApi.reset(emptyAttendeeForm);
          onOpenChange(false);
        },
        onError: (error) =>
          onError(error instanceof Error ? error.message : "Unable to create attendee"),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New attendee</DialogTitle>
          <DialogDescription>
            Add an attendee manually. Email is normalized to lowercase.
          </DialogDescription>
        </DialogHeader>
        <AttendeeFormFields form={form} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
            children={([canSubmit, isSubmitting]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || createMutation.isPending}
              >
                {isSubmitting || createMutation.isPending ? "Saving..." : "Add attendee"}
              </Button>
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditAttendeeDialog({
  attendee,
  onClose,
  onError,
}: {
  attendee: AttendeeDto;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const updateMutation = useUpdateAttendee(attendee.id);

  const form = useForm({
    defaultValues: attendeeToForm(attendee),
    validators: {
      onChange: attendeeFormSchema,
      onSubmit: attendeeFormSchema,
    },
    onSubmit: ({ value }) => {
      updateMutation.mutate(formToAttendeeRequest(value), {
        onSuccess: () => onClose(),
        onError: (error) =>
          onError(error instanceof Error ? error.message : "Unable to update attendee"),
      });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit attendee</DialogTitle>
          <DialogDescription>Update attendee contact details.</DialogDescription>
        </DialogHeader>
        <AttendeeFormFields form={form} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting, state.isPristine] as const}
            children={([canSubmit, isSubmitting, isPristine]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || isPristine || updateMutation.isPending}
              >
                {isSubmitting || updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AttendeeFormFields({ form }: { form: any }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-3"
    >
      <form.Field
        name="name"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children={(field: any) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              required
            />
            {field.state.meta.errors[0] && (
              <p className="text-xs text-destructive">
                {String(
                  (field.state.meta.errors[0] as { message?: string }).message ??
                    field.state.meta.errors[0],
                )}
              </p>
            )}
          </div>
        )}
      />
      <form.Field
        name="email"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children={(field: any) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              type="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              required
            />
            {field.state.meta.errors[0] && (
              <p className="text-xs text-destructive">
                {String(
                  (field.state.meta.errors[0] as { message?: string }).message ??
                    field.state.meta.errors[0],
                )}
              </p>
            )}
          </div>
        )}
      />
      <form.Field
        name="phone"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children={(field: any) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Phone</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Optional"
            />
          </div>
        )}
      />
    </form>
  );
}
