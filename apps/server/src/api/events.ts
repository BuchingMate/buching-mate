import { Hono } from "hono";
import { and, count, eq, gte } from "drizzle-orm";
import type {
  CreateEventRequest,
  EventStatus,
  EventVisibility,
  UpdateEventResourcesRequest,
  UpdateEventRequest,
} from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { integerOrNull, isRecord, readJson, stringOrNull } from "./validation";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import { db } from "../db";
import { events as eventsTable } from "../db/schema";
import {
  createEvent,
  deleteEvent,
  duplicateEvent,
  getEvent,
  listEventResources,
  listEvents,
  replaceEventResources,
  updateEvent,
} from "../services/events";
import { listRegistrationsByEvent } from "../services/registrations";

const FREE_EVENTS_PER_MONTH = 1;

async function enforceFreeEventCap(c: { var: { orgId: string; org: { plan: string } } }) {
  if (c.var.org.plan !== "free") return null;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .select({ n: count() })
    .from(eventsTable)
    .where(and(eq(eventsTable.orgId, c.var.orgId), gte(eventsTable.createdAt, monthStart)));
  if ((rows[0]?.n ?? 0) >= FREE_EVENTS_PER_MONTH) {
    return {
      error: "event_cap_exceeded" as const,
      limit: FREE_EVENTS_PER_MONTH,
    };
  }
  return null;
}

const eventStatuses = ["upcoming", "completed", "cancelled"] as const;
const eventVisibilities = ["published", "unpublished"] as const;

function isEventStatus(value: string): value is EventStatus {
  return eventStatuses.includes(value as EventStatus);
}

function isEventVisibility(value: string): value is EventVisibility {
  return eventVisibilities.includes(value as EventVisibility);
}

function parseEvent(input: unknown, partial: false): CreateEventRequest | string;
function parseEvent(input: unknown, partial: true): UpdateEventRequest | string;
function parseEvent(
  input: unknown,
  partial: boolean,
): CreateEventRequest | UpdateEventRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  const parsed: UpdateEventRequest = {};

  if (!partial || input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim().length === 0)
      return "Event title is required";
    parsed.title = input.title.trim();
  }

  for (const field of [
    "description",
    "notes",
    "category",
    "location",
    "imageUrl",
    "recurrenceFrequency",
    "recurrenceEndDate",
  ] as const) {
    if (input[field] !== undefined) {
      const value = stringOrNull(input[field]);
      if (value === undefined) return `${field} must be a string or null`;
      parsed[field] = value;
    }
  }

  for (const field of ["date", "time"] as const) {
    if (!partial || input[field] !== undefined) {
      if (typeof input[field] !== "string" || input[field].trim().length === 0)
        return `${field} is required`;
      parsed[field] = input[field].trim();
    }
  }

  if (input.price !== undefined) {
    if (typeof input.price !== "number" || !Number.isInteger(input.price) || input.price < 0) {
      return "price must be a non-negative integer (minor units)";
    }
    parsed.price = input.price;
  }

  if (!partial || input.duration !== undefined) {
    if (
      typeof input.duration !== "number" ||
      !Number.isInteger(input.duration) ||
      input.duration <= 0
    ) {
      return "Duration must be a positive integer";
    }
    parsed.duration = input.duration;
  }

  for (const field of ["maxCapacity", "recurrenceInterval"] as const) {
    if (input[field] !== undefined) {
      const value = integerOrNull(input[field]);
      if (value === undefined) return `${field} must be an integer or null`;
      parsed[field] = value;
    }
  }

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !isEventStatus(input.status))
      return "Event status is invalid";
    parsed.status = input.status;
  }

  if (input.visibility !== undefined) {
    if (typeof input.visibility !== "string" || !isEventVisibility(input.visibility))
      return "Event visibility is invalid";
    parsed.visibility = input.visibility;
  }

  if (input.archivedAt !== undefined) {
    const value = stringOrNull(input.archivedAt);
    if (value === undefined) return "archivedAt must be a string or null";
    if (value !== null && Number.isNaN(Date.parse(value))) {
      return "archivedAt must be a valid date string or null";
    }
    parsed.archivedAt = value;
  }

  if (input.recurring !== undefined) {
    if (typeof input.recurring !== "boolean") return "Recurring must be a boolean";
    parsed.recurring = input.recurring;
  }

  if (input.allDay !== undefined) {
    if (typeof input.allDay !== "boolean") return "allDay must be a boolean";
    parsed.allDay = input.allDay;
  }

  if (input.recurrenceDays !== undefined) {
    if (
      !Array.isArray(input.recurrenceDays) ||
      input.recurrenceDays.some((day) => typeof day !== "string")
    ) {
      return "Recurrence days must be an array of strings";
    }
    parsed.recurrenceDays = input.recurrenceDays;
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== "string")) {
      return "Tags must be an array of strings";
    }
    parsed.tags = (input.tags as string[]).map((tag) => tag.trim()).filter(Boolean);
  }

  if (partial && Object.keys(parsed).length === 0) return "At least one field is required";
  return parsed as CreateEventRequest | UpdateEventRequest;
}

function parseEventResources(input: unknown): UpdateEventResourcesRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  if (!Array.isArray(input.resources)) return "Resources must be an array";

  const resources: UpdateEventResourcesRequest["resources"] = [];

  for (const assignment of input.resources) {
    if (!isRecord(assignment)) return "Each resource assignment must be an object";
    if (typeof assignment.resourceId !== "string" || assignment.resourceId.length === 0) {
      return "Resource ID is required";
    }
    if (typeof assignment.role !== "string" || assignment.role.trim().length === 0) {
      return "Resource role is required";
    }
    if (
      assignment.quantity !== undefined &&
      (typeof assignment.quantity !== "number" ||
        !Number.isInteger(assignment.quantity) ||
        assignment.quantity < 1)
    ) {
      return "Resource quantity must be a positive integer";
    }

    resources.push({
      resourceId: assignment.resourceId,
      role: assignment.role.trim(),
      quantity: assignment.quantity,
    });
  }

  return { resources };
}

export const eventRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .get("/", async (c) => c.json({ events: await listEvents(c.var.orgId) }))
  .post("/", requireRole("manager"), async (c) => {
    const input = parseEvent(await readJson(c), false);
    if (typeof input === "string") return apiError(c, 400, "invalid_event", input);
    const cap = await enforceFreeEventCap(c);
    if (cap) return apiError(c, 402, cap.error, `Free plan allows ${cap.limit} event per month`);
    return c.json({ event: await createEvent(c.var.orgId, c.var.user.id, input) }, 201);
  })
  .get("/:eventId", async (c) => {
    const event = await getEvent(c.var.orgId, c.req.param("eventId"));
    if (!event) return apiError(c, 404, "event_not_found", "Event not found");
    return c.json({ event });
  })
  .patch("/:eventId", requireRole("manager"), async (c) => {
    const input = parseEvent(await readJson(c), true);
    if (typeof input === "string") return apiError(c, 400, "invalid_event", input);
    const event = await updateEvent(c.var.orgId, c.req.param("eventId"), input);
    if (!event) return apiError(c, 404, "event_not_found", "Event not found");
    return c.json({ event });
  })
  .delete("/:eventId", requireRole("admin"), async (c) => {
    const deleted = await deleteEvent(c.var.orgId, c.req.param("eventId"));
    if (!deleted) return apiError(c, 404, "event_not_found", "Event not found");
    return c.json({ deleted: true });
  })
  .post("/:eventId/duplicate", requireRole("manager"), async (c) => {
    const cap = await enforceFreeEventCap(c);
    if (cap) return apiError(c, 402, cap.error, `Free plan allows ${cap.limit} event per month`);
    const event = await duplicateEvent(c.var.orgId, c.var.user.id, c.req.param("eventId"));
    if (!event) return apiError(c, 404, "event_not_found", "Event not found");
    return c.json({ event }, 201);
  })
  .get("/:eventId/registrations", async (c) =>
    c.json({ registrations: await listRegistrationsByEvent(c.var.orgId, c.req.param("eventId")) }),
  )
  .get("/:eventId/resources", async (c) =>
    c.json({ resources: await listEventResources(c.var.orgId, c.req.param("eventId")) }),
  )
  .put("/:eventId/resources", requireRole("manager"), async (c) => {
    const input = parseEventResources(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_event_resources", input);

    const resources = await replaceEventResources(
      c.var.orgId,
      c.req.param("eventId"),
      input.resources,
    );
    if (resources === "event_not_found")
      return apiError(c, 404, "event_not_found", "Event not found");
    if (resources === "resource_not_found") {
      return apiError(c, 404, "resource_not_found", "One or more resources were not found");
    }

    return c.json({ resources });
  });
