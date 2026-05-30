import type { CreateEventRequest, EventDto, UpdateEventRequest } from "@workspace/contracts";
import { z } from "zod";
import { api } from "./api";
import { browserTimezone, centsToMajorString, majorStringToCents } from "./public";

const baseEventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.string().regex(/^\d+$/, "Duration must be a whole number"),
  endDate: z.string(),
  endTime: z.string(),
  timezone: z.string().min(1, "Timezone is required"),
  reviewerId: z.string(),
  videoProvider: z.enum(["", "zoom"]),
  requireApproval: z.enum(["true", "false"]),
  allDay: z.enum(["true", "false"]),
  maxCapacity: z.string().regex(/^\d*$/, "Capacity must be a whole number"),
  category: z.string(),
  tags: z.string(),
  status: z.enum(["upcoming", "completed", "cancelled"]),
  visibility: z.enum(["published", "unpublished"]),
  description: z.string(),
  notes: z.string(),
  location: z.string(),
  locationLat: z.string(),
  locationLng: z.string(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must look like 0.00"),
  recurring: z.enum(["true", "false"]),
  recurrenceFrequency: z.string(),
  recurrenceInterval: z.string().regex(/^\d*$/, "Interval must be a whole number"),
  recurrenceDays: z.string(),
  recurrenceEndDate: z.string(),
  imageUrl: z.string(),
});

export const eventFormSchema = baseEventFormSchema
  .refine(
    (v) =>
      !(v.date && v.time && v.endDate && v.endTime) ||
      `${v.endDate}T${v.endTime}` >= `${v.date}T${v.time}`,
    { message: "End must be after the start", path: ["endTime"] },
  )
  .refine((v) => v.requireApproval !== "true" || v.reviewerId.trim().length > 0, {
    message: "Choose a reviewer",
    path: ["reviewerId"],
  });

export type EventFormState = z.infer<typeof baseEventFormSchema>;

export const emptyEventForm: EventFormState = {
  title: "",
  date: "",
  time: "",
  duration: "60",
  endDate: "",
  endTime: "",
  timezone: "UTC",
  reviewerId: "",
  videoProvider: "",
  requireApproval: "false",
  allDay: "false",
  maxCapacity: "",
  category: "",
  tags: "",
  status: "upcoming",
  visibility: "unpublished",
  description: "",
  notes: "",
  location: "",
  locationLat: "",
  locationLng: "",
  price: "0.00",
  recurring: "false",
  recurrenceFrequency: "",
  recurrenceInterval: "",
  recurrenceDays: "",
  recurrenceEndDate: "",
  imageUrl: "",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function nextHalfHour(now: Date) {
  const minutes = now.getMinutes();
  const rounded = minutes < 30 ? 30 : 60;
  const next = new Date(now);
  next.setMinutes(rounded, 0, 0);
  return `${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

export function defaultEventForm(): EventFormState {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = nextHalfHour(now);
  // Default end one hour after start, same day.
  const [h, m] = time.split(":").map(Number);
  const endTime = `${pad((h + 1) % 24)}:${pad(m)}`;
  const endDate = h + 1 >= 24 ? nextDay(date) : date;
  return {
    ...emptyEventForm,
    date,
    time,
    endDate,
    endTime,
    timezone: browserTimezone(),
  };
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function eventToForm(event: EventDto, currency: string): EventFormState {
  return {
    title: event.title,
    date: event.date,
    time: event.time.slice(0, 5),
    duration: String(event.duration),
    endDate: event.endDate ?? "",
    endTime: event.endTime ? event.endTime.slice(0, 5) : "",
    timezone: event.timezone,
    reviewerId: event.reviewerId ?? "",
    videoProvider: event.video?.provider === "zoom" ? "zoom" : "",
    requireApproval: event.reviewerId ? "true" : "false",
    allDay: event.allDay ? "true" : "false",
    maxCapacity: event.maxCapacity === null ? "" : String(event.maxCapacity),
    category: event.category ?? "",
    tags: event.tags.join(", "),
    status: event.status,
    visibility: event.visibility,
    description: event.description ?? "",
    notes: event.notes ?? "",
    location: event.location ?? "",
    locationLat: event.locationLat === null ? "" : String(event.locationLat),
    locationLng: event.locationLng === null ? "" : String(event.locationLng),
    price: centsToMajorString(event.price, currency),
    recurring: event.recurring ? "true" : "false",
    recurrenceFrequency: event.recurrenceFrequency ?? "",
    recurrenceInterval: event.recurrenceInterval === null ? "" : String(event.recurrenceInterval),
    recurrenceDays: event.recurrenceDays.join(", "),
    recurrenceEndDate: event.recurrenceEndDate ?? "",
    imageUrl: event.imageUrl ?? "",
  };
}

export function formToEventRequest(form: EventFormState, currency: string): CreateEventRequest {
  const allDay = form.allDay === "true";
  const requireApproval = form.requireApproval === "true";
  return {
    title: form.title,
    date: form.date,
    time: allDay ? "00:00" : form.time,
    duration: allDay ? 1440 : Number(form.duration),
    endDate: allDay ? null : form.endDate || null,
    endTime: allDay ? null : form.endTime || null,
    timezone: form.timezone || "UTC",
    reviewerId: requireApproval ? form.reviewerId || null : null,
    videoProvider: form.videoProvider === "zoom" ? "zoom" : null,
    allDay,
    maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
    category: form.category.trim() || null,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    status: form.status,
    visibility: form.visibility,
    description: form.description.trim() || null,
    notes: form.notes.trim() || null,
    location: form.location.trim() || null,
    locationLat: form.locationLat ? Number(form.locationLat) : null,
    locationLng: form.locationLng ? Number(form.locationLng) : null,
    price: majorStringToCents(form.price, currency),
    recurring: form.recurring === "true",
    recurrenceFrequency: form.recurrenceFrequency.trim() || null,
    recurrenceInterval: form.recurrenceInterval ? Number(form.recurrenceInterval) : null,
    recurrenceDays: form.recurrenceDays
      .split(",")
      .map((day) => day.trim())
      .filter(Boolean),
    recurrenceEndDate: form.recurrenceEndDate || null,
    imageUrl: form.imageUrl.trim() || null,
  };
}

export function listEvents() {
  return api.get<{ events: EventDto[] }>("/api/events");
}

export function getEvent(eventId: string) {
  return api.get<{ event: EventDto }>(`/api/events/${eventId}`);
}

export function createEvent(input: CreateEventRequest) {
  return api.post<{ event: EventDto }>("/api/events", input);
}

export function updateEvent(eventId: string, input: UpdateEventRequest) {
  return api.patch<{ event: EventDto }>(`/api/events/${eventId}`, input);
}

export function deleteEvent(eventId: string) {
  return api.delete<{ deleted: true }>(`/api/events/${eventId}`);
}

export function duplicateEvent(eventId: string) {
  return api.post<{ event: EventDto }>(`/api/events/${eventId}/duplicate`, {});
}

export function approveEvent(eventId: string) {
  return api.post<{ event: EventDto }>(`/api/events/${eventId}/approve`, {});
}

export function rejectEvent(eventId: string, note: string | null) {
  return api.post<{ event: EventDto }>(`/api/events/${eventId}/reject`, { note });
}
