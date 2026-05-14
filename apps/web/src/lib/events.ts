import type { CreateEventRequest, EventDto, UpdateEventRequest } from "@workspace/contracts";
import { z } from "zod";
import { api } from "./api";
import { centsToMajorString, majorStringToCents } from "./public";

export const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.string().regex(/^\d+$/, "Duration must be a whole number"),
  allDay: z.enum(["true", "false"]),
  maxCapacity: z.string().regex(/^\d*$/, "Capacity must be a whole number"),
  category: z.string(),
  tags: z.string(),
  status: z.enum(["upcoming", "completed", "cancelled"]),
  visibility: z.enum(["published", "unpublished"]),
  description: z.string(),
  notes: z.string(),
  location: z.string(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must look like 0.00"),
  isFree: z.enum(["true", "false"]),
  recurring: z.enum(["true", "false"]),
  recurrenceFrequency: z.string(),
  recurrenceInterval: z.string().regex(/^\d*$/, "Interval must be a whole number"),
  recurrenceDays: z.string(),
  recurrenceEndDate: z.string(),
  imageUrl: z.string(),
});

export type EventFormState = z.infer<typeof eventFormSchema>;

export const emptyEventForm: EventFormState = {
  title: "",
  date: "",
  time: "",
  duration: "60",
  allDay: "false",
  maxCapacity: "",
  category: "",
  tags: "",
  status: "upcoming",
  visibility: "unpublished",
  description: "",
  notes: "",
  location: "",
  price: "0.00",
  isFree: "false",
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
  return { ...emptyEventForm, date, time: nextHalfHour(now) };
}

export function eventToForm(event: EventDto): EventFormState {
  return {
    title: event.title,
    date: event.date,
    time: event.time,
    duration: String(event.duration),
    allDay: event.allDay ? "true" : "false",
    maxCapacity: event.maxCapacity === null ? "" : String(event.maxCapacity),
    category: event.category ?? "",
    tags: event.tags.join(", "),
    status: event.status,
    visibility: event.visibility,
    description: event.description ?? "",
    notes: event.notes ?? "",
    location: event.location ?? "",
    price: centsToMajorString(event.price, "USD"),
    isFree: event.price === 0 ? "true" : "false",
    recurring: event.recurring ? "true" : "false",
    recurrenceFrequency: event.recurrenceFrequency ?? "",
    recurrenceInterval: event.recurrenceInterval === null ? "" : String(event.recurrenceInterval),
    recurrenceDays: event.recurrenceDays.join(", "),
    recurrenceEndDate: event.recurrenceEndDate ?? "",
    imageUrl: event.imageUrl ?? "",
  };
}

export function formToEventRequest(form: EventFormState): CreateEventRequest {
  const allDay = form.allDay === "true";
  return {
    title: form.title,
    date: form.date,
    time: allDay ? "00:00" : form.time,
    duration: allDay ? 1440 : Number(form.duration),
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
    price: form.isFree === "true" ? 0 : majorStringToCents(form.price, "USD"),
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
