import type { EventDto, PaymentStatus, RegistrationWithAttendeeDto } from "@workspace/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const paymentStatuses: PaymentStatus[] = [
  "not_required",
  "pending",
  "paid",
  "refunded",
  "expired",
];

export function RegistrationSummary({
  event,
  registrations,
}: {
  event: EventDto;
  registrations: RegistrationWithAttendeeDto[];
}) {
  const confirmed = registrations.filter(
    (registration) => registration.status === "confirmed",
  ).length;
  const waitlisted = registrations.filter(
    (registration) => registration.status === "waitlisted",
  ).length;
  const capacity = event.maxCapacity;
  const utilization = capacity && capacity > 0 ? Math.round((confirmed / capacity) * 100) : null;
  const paymentCounts = Object.fromEntries(
    paymentStatuses.map((status) => [
      status,
      registrations.filter((registration) => registration.paymentStatus === status).length,
    ]),
  ) as Record<PaymentStatus, number>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Confirmed" value={String(confirmed)} />
      <SummaryCard label="Waitlisted" value={String(waitlisted)} />
      <SummaryCard
        label="Capacity"
        value={capacity && capacity > 0 ? `${confirmed}/${capacity}` : "Uncapped"}
        detail={utilization === null ? undefined : `${utilization}% full`}
      />
      <SummaryCard
        label="Payments"
        value={`${paymentCounts.paid} paid`}
        detail={`${paymentCounts.pending} pending · ${paymentCounts.refunded} refunded`}
      />
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function PaymentStatusSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: PaymentStatus;
  onChange: (value: PaymentStatus) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(value) => onChange(value as PaymentStatus)}
      disabled={disabled}
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {paymentStatuses.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
