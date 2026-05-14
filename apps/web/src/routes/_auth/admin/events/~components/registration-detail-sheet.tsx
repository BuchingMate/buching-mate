import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowUpCircle,
  Ban,
  Check,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { PaymentStatus, RegistrationWithAttendeeDto } from "@workspace/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { refundRegistration } from "@/lib/payments";
import { PaymentStatusSelect } from "./registration-summary";
import type { ConfirmFn } from "./confirm-dialog";

type StatusVariant = "default" | "secondary" | "outline" | "success";

const statusVariant: Record<RegistrationWithAttendeeDto["status"], StatusVariant> = {
  pending: "secondary",
  confirmed: "success",
  waitlisted: "secondary",
  cancelled: "outline",
};

export function RegistrationDetailSheet({
  registration,
  open,
  onOpenChange,
  canManage,
  canDelete,
  onUpdateStatus,
  onUpdatePayment,
  onDelete,
  confirm,
}: {
  registration: RegistrationWithAttendeeDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  canDelete: boolean;
  onUpdateStatus: (id: string, status: RegistrationWithAttendeeDto["status"]) => void;
  onUpdatePayment: (id: string, payment: PaymentStatus) => void;
  onDelete: (id: string) => void;
  confirm: ConfirmFn;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0">
        {registration && (
          <DetailBody
            registration={registration}
            canManage={canManage}
            canDelete={canDelete}
            onUpdateStatus={onUpdateStatus}
            onUpdatePayment={onUpdatePayment}
            onDelete={onDelete}
            onClose={() => onOpenChange(false)}
            confirm={confirm}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({
  registration,
  canManage,
  canDelete,
  onUpdateStatus,
  onUpdatePayment,
  onDelete,
  onClose,
  confirm,
}: {
  registration: RegistrationWithAttendeeDto;
  canManage: boolean;
  canDelete: boolean;
  onUpdateStatus: (id: string, status: RegistrationWithAttendeeDto["status"]) => void;
  onUpdatePayment: (id: string, payment: PaymentStatus) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  confirm: ConfirmFn;
}) {
  const { attendee } = registration;
  const initials = getInitials(attendee.name);

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center gap-3 pe-8">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base">{attendee.name}</SheetTitle>
            <SheetDescription className="truncate">{attendee.email}</SheetDescription>
          </div>
          <Badge variant={statusVariant[registration.status]} className="capitalize">
            {registration.status}
          </Badge>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Section title="Contact">
          <ContactRow
            icon={<Mail className="size-3.5" />}
            label="Email"
            value={attendee.email}
            actionHref={`mailto:${attendee.email}`}
            actionLabel="Email"
          />
          {attendee.phone && (
            <ContactRow
              icon={<Phone className="size-3.5" />}
              label="Phone"
              value={attendee.phone}
              actionHref={`tel:${attendee.phone}`}
              actionLabel="Call"
            />
          )}
          <Link
            to="/admin/attendees/$attendeeId"
            params={{ attendeeId: attendee.id }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            Open attendee profile
          </Link>
        </Section>

        <Section title="Registration">
          <Field label="Status">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant[registration.status]} className="capitalize">
                {registration.status}
              </Badge>
              {canManage && registration.status === "waitlisted" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => onUpdateStatus(registration.id, "confirmed")}
                >
                  <ArrowUpCircle className="size-3.5" />
                  Promote
                </Button>
              )}
              {canManage && registration.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Cancel this registration?",
                      description: `${attendee.name} will be marked as cancelled.`,
                      confirmLabel: "Cancel registration",
                      cancelLabel: "Keep",
                      destructive: true,
                    });
                    if (!ok) return;
                    onUpdateStatus(registration.id, "cancelled");
                  }}
                >
                  <Ban className="size-3.5" />
                  Cancel
                </Button>
              )}
            </div>
          </Field>
          <Field label="Payment">
            <div className="flex items-center gap-2">
              <PaymentStatusSelect
                value={registration.paymentStatus}
                onChange={(p) => onUpdatePayment(registration.id, p)}
                disabled={!canManage}
              />
              {canManage && registration.paymentStatus === "paid" ? (
                <RefundButton
                  registrationId={registration.id}
                  attendeeName={attendee.name}
                  confirm={confirm}
                />
              ) : null}
            </div>
          </Field>
          <Field label="Registered">
            <span className="text-sm">{formatFullDate(registration.createdAt)}</span>
          </Field>
        </Section>
      </div>

      {canDelete && (
        <div className="border-t p-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive"
            onClick={async () => {
              const ok = await confirm({
                title: "Remove this registration?",
                description: `Remove ${attendee.name} from this event.`,
                confirmLabel: "Remove",
                destructive: true,
              });
              if (!ok) return;
              onDelete(registration.id);
              onClose();
            }}
          >
            <Trash2 className="size-3.5" />
            Remove registration
          </Button>
        </div>
      )}
    </>
  );
}

function RefundButton({
  registrationId,
  attendeeName,
  confirm,
}: {
  registrationId: string;
  attendeeName: string;
  confirm: ConfirmFn;
}) {
  const [submitted, setSubmitted] = useState(false);
  const mutation = useMutation({
    mutationFn: () => refundRegistration({ registrationId }),
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <Badge variant="outline" className="text-xs">
        Refund pending
      </Badge>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 gap-1 px-2 text-xs"
      disabled={mutation.isPending}
      onClick={async () => {
        const ok = await confirm({
          title: "Refund this payment?",
          description: `Issue a full refund to ${attendeeName}. Status updates when the provider confirms.`,
          confirmLabel: "Refund",
          destructive: true,
        });
        if (!ok) return;
        mutation.mutate();
      }}
    >
      <RotateCcw className="size-3.5" />
      Refund
    </Button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  actionHref: string;
  actionLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-3xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-sm">{value}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          title={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </Button>
        <Button
          render={<a href={actionHref} />}
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFullDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
