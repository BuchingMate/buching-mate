import type {
  CreateRegistrationRequest,
  RegistrationDto,
  RegistrationWithAttendeeDto,
  UpdateRegistrationRequest,
} from "@workspace/contracts";
import { api } from "./api";

export function listRegistrations() {
  return api.get<{ registrations: RegistrationDto[] }>("/api/registrations");
}

export function listEventRegistrations(eventId: string) {
  return api.get<{ registrations: RegistrationWithAttendeeDto[] }>(
    `/api/events/${eventId}/registrations`,
  );
}

export function createRegistration(input: CreateRegistrationRequest) {
  return api.post<{ registration: RegistrationDto }>("/api/registrations", input);
}

export function updateRegistration(registrationId: string, input: UpdateRegistrationRequest) {
  return api.patch<{ registration: RegistrationDto }>(
    `/api/registrations/${registrationId}`,
    input,
  );
}

export function deleteRegistration(registrationId: string) {
  return api.delete<{ deleted: true }>(`/api/registrations/${registrationId}`);
}
