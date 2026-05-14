import type {
  AttendeeDto,
  CreateAttendeeRequest,
  RegistrationWithEventDto,
  UpdateAttendeeRequest,
} from "@workspace/contracts";
import { z } from "zod";
import { api } from "./api";

export const attendeeFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string(),
});

export type AttendeeFormState = z.infer<typeof attendeeFormSchema>;

export const emptyAttendeeForm: AttendeeFormState = {
  name: "",
  email: "",
  phone: "",
};

export function attendeeToForm(attendee: AttendeeDto): AttendeeFormState {
  return {
    name: attendee.name,
    email: attendee.email,
    phone: attendee.phone ?? "",
  };
}

export function formToAttendeeRequest(form: AttendeeFormState): CreateAttendeeRequest {
  return {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim() || null,
  };
}

export function listAttendees(search?: string | null) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return api.get<{ attendees: AttendeeDto[] }>(`/api/attendees${query}`);
}

export function getAttendee(attendeeId: string) {
  return api.get<{ attendee: AttendeeDto }>(`/api/attendees/${attendeeId}`);
}

export function createAttendee(input: CreateAttendeeRequest) {
  return api.post<{ attendee: AttendeeDto }>("/api/attendees", input);
}

export function updateAttendee(attendeeId: string, input: UpdateAttendeeRequest) {
  return api.patch<{ attendee: AttendeeDto }>(`/api/attendees/${attendeeId}`, input);
}

export function listAttendeeRegistrations(attendeeId: string) {
  return api.get<{ registrations: RegistrationWithEventDto[] }>(
    `/api/attendees/${attendeeId}/registrations`,
  );
}
