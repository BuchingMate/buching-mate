import { useState } from "react";
import type { AttendeeDto, PaymentStatus, RegistrationWithAttendeeDto } from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAttendee } from "@/hooks/use-attendees";
import { useCreateRegistration } from "@/hooks/use-registrations";
import { PaymentStatusSelect } from "../registration-summary";

type FormState = {
  attendeeId: string;
  name: string;
  email: string;
  phone: string;
  status: RegistrationWithAttendeeDto["status"];
  paymentStatus: PaymentStatus;
};

const EMPTY_FORM: FormState = {
  attendeeId: "",
  name: "",
  email: "",
  phone: "",
  status: "confirmed",
  paymentStatus: "not_required",
};

export function AddRegistrationDialog({
  eventId,
  attendees,
  open,
  onOpenChange,
  onError,
}: {
  eventId: string;
  attendees: AttendeeDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedAttendee, setSelectedAttendee] = useState<AttendeeDto | null>(null);
  const createRegistrationMutation = useCreateRegistration(eventId);
  const createAttendeeMutation = useCreateAttendee();

  const reset = () => {
    setForm(EMPTY_FORM);
    setSelectedAttendee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let attendeeId = form.attendeeId;
      if (!attendeeId) {
        const attendee = await createAttendeeMutation.mutateAsync({
          name: form.name,
          email: form.email,
          phone: form.phone.trim() || null,
        });
        attendeeId = attendee.attendee.id;
      }

      await createRegistrationMutation.mutateAsync({
        eventId,
        attendeeId,
        status: form.status,
        paymentStatus: form.paymentStatus,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to create registration");
    }
  };

  const isPending = createRegistrationMutation.isPending || createAttendeeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add registration</DialogTitle>
          <DialogDescription>Select an attendee or create one inline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="attendee-combobox">Attendee</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setSelectedAttendee(null);
                    setForm((current) => ({
                      ...current,
                      attendeeId: "",
                      name: "",
                      email: "",
                      phone: "",
                    }));
                  }}
                >
                  + Create new
                </Button>
              </div>
              <Combobox<AttendeeDto>
                items={attendees}
                value={selectedAttendee}
                onValueChange={(attendee) => {
                  setSelectedAttendee(attendee ?? null);
                  setForm((current) => ({
                    ...current,
                    attendeeId: attendee?.id ?? "",
                    name: attendee?.name ?? "",
                    email: attendee?.email ?? "",
                    phone: attendee?.phone ?? "",
                  }));
                }}
                itemToStringLabel={(attendee) => `${attendee.name} (${attendee.email})`}
                itemToStringValue={(attendee) => attendee.id}
                isItemEqualToValue={(a, b) => a.id === b.id}
              >
                <ComboboxInput id="attendee-combobox" placeholder="Search by name or email" />
                <ComboboxContent>
                  <ComboboxList>
                    {(attendee: AttendeeDto) => (
                      <ComboboxItem key={attendee.id} value={attendee}>
                        <div className="flex flex-col">
                          <span className="text-sm">{attendee.name}</span>
                          <span className="text-xs text-muted-foreground">{attendee.email}</span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                  <ComboboxEmpty>
                    No matching attendee. Use "+ Create new" to add one.
                  </ComboboxEmpty>
                </ComboboxContent>
              </Combobox>
            </div>
            {!form.attendeeId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="attendee-name">Name</Label>
                  <Input
                    id="attendee-name"
                    value={form.name}
                    onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee-email">Email</Label>
                  <Input
                    id="attendee-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee-phone">Phone</Label>
                  <Input
                    id="attendee-phone"
                    value={form.phone}
                    onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    status: value as RegistrationWithAttendeeDto["status"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="waitlisted">Waitlisted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment</Label>
              <PaymentStatusSelect
                value={form.paymentStatus}
                onChange={(paymentStatus) => setForm((current) => ({ ...current, paymentStatus }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
