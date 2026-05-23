import type {
  CreateEventRequest,
  EventDto,
  EventImageDto,
  EventResourceDto,
  UpdateEventRequest,
} from "@workspace/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { eventResources, events, publicAssets, resources, registrations } from "../../db/schema";
import { rewritePublicAssetUrl } from "../assets/public-url";
import { incrementUsage } from "../subscription-usage";
import { getLogger } from "../../observability/request-context";
import {
  attachZoomMeetingToEvent,
  detachZoomMeetingFromEvent,
  markConnectionError,
  markConnectionHealthy,
  syncZoomMeetingForEvent,
} from "../video";

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function safeAttachZoom(orgId: string, eventId: string) {
  try {
    await attachZoomMeetingToEvent(orgId, eventId);
    await markConnectionHealthy(orgId, "zoom");
  } catch (err) {
    getLogger().warn({ err, orgId, eventId }, "video.zoom.attachFailed");
    await markConnectionError(orgId, "zoom", errMessage(err)).catch(() => {});
  }
}

async function safeSyncZoom(
  orgId: string,
  eventId: string,
  patch: {
    topic?: string;
    startUtc?: Date;
    durationMinutes?: number;
    agenda?: string | null;
    recurrence?: import("../../video/adapter").RecurrenceInput | null;
  },
) {
  try {
    await syncZoomMeetingForEvent(orgId, eventId, patch);
    await markConnectionHealthy(orgId, "zoom");
  } catch (err) {
    getLogger().warn({ err, orgId, eventId }, "video.zoom.syncFailed");
    await markConnectionError(orgId, "zoom", errMessage(err)).catch(() => {});
  }
}

async function safeDetachZoom(orgId: string, eventId: string) {
  try {
    await detachZoomMeetingFromEvent(orgId, eventId);
  } catch (err) {
    getLogger().warn({ err, orgId, eventId }, "video.zoom.detachFailed");
    await markConnectionError(orgId, "zoom", errMessage(err)).catch(() => {});
  }
}

function combineDateTimeUtc(date: string, time: string): Date {
  const hhmm = time.length >= 5 ? time.slice(0, 5) : "00:00";
  return new Date(`${date}T${hhmm}:00Z`);
}

export function toEventDto(
  event: typeof events.$inferSelect,
  confirmedCount = 0,
  waitlistedCount = 0,
  detailImages: EventImageDto[] = [],
): EventDto {
  return {
    id: event.id,
    orgId: event.orgId,
    createdById: event.createdById,
    title: event.title,
    description: event.description,
    notes: event.notes,
    category: event.category,
    tags: event.tags,
    date: event.date,
    time: event.time,
    duration: event.duration,
    allDay: event.allDay,
    maxCapacity: event.maxCapacity,
    location: event.location,
    status: event.status,
    visibility: event.visibility,
    archivedAt: event.archivedAt?.toISOString() ?? null,
    recurring: event.recurring,
    recurrenceFrequency: event.recurrenceFrequency,
    recurrenceDays: event.recurrenceDays,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceEndDate: event.recurrenceEndDate,
    price: event.price,
    imageUrl: rewritePublicAssetUrl(event.imageUrl),
    detailImages,
    confirmedRegistrations: confirmedCount,
    waitlistedRegistrations: waitlistedCount,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

async function listEventDetailImages(orgId: string, eventId: string): Promise<EventImageDto[]> {
  const rows = await db
    .select({ id: publicAssets.id, publicUrl: publicAssets.publicUrl })
    .from(publicAssets)
    .where(
      and(
        eq(publicAssets.orgId, orgId),
        eq(publicAssets.eventId, eventId),
        eq(publicAssets.kind, "event_image"),
        eq(publicAssets.assetRole, "detail"),
        eq(publicAssets.status, "ready"),
      ),
    )
    .orderBy(asc(publicAssets.createdAt));

  return rows.map((row) => ({
    id: row.id,
    url: rewritePublicAssetUrl(row.publicUrl) ?? row.publicUrl,
  }));
}

function toEventResourceDto(eventResource: typeof eventResources.$inferSelect): EventResourceDto {
  return {
    id: eventResource.id,
    orgId: eventResource.orgId,
    eventId: eventResource.eventId,
    resourceId: eventResource.resourceId,
    role: eventResource.role,
    quantity: eventResource.quantity,
    createdAt: eventResource.createdAt.toISOString(),
    updatedAt: eventResource.updatedAt.toISOString(),
  };
}

export async function listEvents(orgId: string): Promise<EventDto[]> {
  const rows = await db.select().from(events).where(eq(events.orgId, orgId));

  const eventIds = rows.map((row) => row.id);

  let counts: Array<{ eventId: string; status: string; count: number }> = [];
  if (eventIds.length > 0) {
    counts = await db
      .select({
        eventId: registrations.eventId,
        status: registrations.status,
        count: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(and(eq(registrations.orgId, orgId), inArray(registrations.eventId, eventIds)))
      .groupBy(registrations.eventId, registrations.status);
  }

  const countMap = new Map<string, { confirmed: number; waitlisted: number }>();
  for (const row of rows) {
    countMap.set(row.id, { confirmed: 0, waitlisted: 0 });
  }
  for (const c of counts) {
    const existing = countMap.get(c.eventId);
    if (existing) {
      if (c.status === "confirmed" || c.status === "pending") existing.confirmed += c.count;
      if (c.status === "waitlisted") existing.waitlisted = c.count;
    }
  }

  return rows.map((row) => {
    const counts = countMap.get(row.id) ?? { confirmed: 0, waitlisted: 0 };
    return toEventDto(row, counts.confirmed, counts.waitlisted);
  });
}

export async function getEvent(orgId: string, eventId: string): Promise<EventDto | null> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1);

  if (!rows[0]) return null;

  const counts = await db
    .select({
      status: registrations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(registrations)
    .where(and(eq(registrations.orgId, orgId), eq(registrations.eventId, eventId)))
    .groupBy(registrations.status);

  const confirmed =
    (counts.find((c) => c.status === "confirmed")?.count ?? 0) +
    (counts.find((c) => c.status === "pending")?.count ?? 0);
  const waitlisted = counts.find((c) => c.status === "waitlisted")?.count ?? 0;

  const detailImages = await listEventDetailImages(orgId, eventId);
  return toEventDto(rows[0], confirmed, waitlisted, detailImages);
}

export async function createEvent(
  orgId: string,
  createdById: string,
  input: CreateEventRequest,
): Promise<EventDto> {
  const rows = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(events)
      .values({
        orgId,
        createdById,
        title: input.title,
        description: input.description ?? null,
        notes: input.notes ?? null,
        category: input.category ?? null,
        tags: input.tags ?? [],
        date: input.date,
        time: input.time,
        duration: input.duration,
        allDay: input.allDay ?? false,
        maxCapacity: input.maxCapacity ?? null,
        location: input.location ?? null,
        status: input.status ?? "upcoming",
        visibility: input.visibility ?? "unpublished",
        recurring: input.recurring ?? false,
        recurrenceFrequency: input.recurrenceFrequency ?? null,
        recurrenceDays: input.recurrenceDays ?? [],
        recurrenceInterval: input.recurrenceInterval ?? null,
        recurrenceEndDate: input.recurrenceEndDate ?? null,
        price: input.price ?? 0,
        imageUrl: input.imageUrl ?? null,
      })
      .returning();
    await incrementUsage(tx, orgId, "events_created");
    return inserted;
  });

  if (rows[0].visibility === "published" && rows[0].status !== "cancelled") {
    await safeAttachZoom(orgId, rows[0].id);
  }

  return toEventDto(rows[0], 0, 0);
}

export async function updateEvent(
  orgId: string,
  eventId: string,
  input: UpdateEventRequest,
): Promise<EventDto | null> {
  const before = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1);
  const prev = before[0];

  const { archivedAt, ...eventInput } = input;
  const patch: Partial<typeof events.$inferInsert> = { ...eventInput, updatedAt: new Date() };
  if (archivedAt !== undefined) {
    patch.archivedAt = archivedAt === null ? null : new Date(archivedAt);
  }

  const rows = await db
    .update(events)
    .set(patch)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .returning();

  if (!rows[0]) return null;

  const next = rows[0];
  if (prev) {
    const wasLive = prev.visibility === "published" && prev.status !== "cancelled";
    const isLive = next.visibility === "published" && next.status !== "cancelled";
    if (!wasLive && isLive) {
      await safeAttachZoom(orgId, next.id);
    } else if (wasLive && !isLive) {
      await safeDetachZoom(orgId, next.id);
    } else if (isLive) {
      const videoPatch: Parameters<typeof safeSyncZoom>[2] = {};
      if (prev.title !== next.title) videoPatch.topic = next.title;
      if (prev.duration !== next.duration) videoPatch.durationMinutes = next.duration;
      if (prev.description !== next.description) videoPatch.agenda = next.description ?? null;
      if (prev.date !== next.date || prev.time !== next.time) {
        videoPatch.startUtc = combineDateTimeUtc(next.date, next.time);
      }
      const recurrenceChanged =
        prev.recurring !== next.recurring ||
        prev.recurrenceFrequency !== next.recurrenceFrequency ||
        prev.recurrenceInterval !== next.recurrenceInterval ||
        prev.recurrenceEndDate !== next.recurrenceEndDate ||
        JSON.stringify(prev.recurrenceDays) !== JSON.stringify(next.recurrenceDays);
      if (recurrenceChanged) {
        const { recurrenceForEvent } = await import("../video");
        videoPatch.recurrence = recurrenceForEvent(next);
      }
      if (Object.keys(videoPatch).length > 0) {
        await safeSyncZoom(orgId, next.id, videoPatch);
      }
    }
  }

  const counts = await db
    .select({
      status: registrations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(registrations)
    .where(and(eq(registrations.orgId, orgId), eq(registrations.eventId, eventId)))
    .groupBy(registrations.status);

  const confirmed =
    (counts.find((c) => c.status === "confirmed")?.count ?? 0) +
    (counts.find((c) => c.status === "pending")?.count ?? 0);
  const waitlisted = counts.find((c) => c.status === "waitlisted")?.count ?? 0;

  const detailImages = await listEventDetailImages(orgId, eventId);
  return toEventDto(rows[0], confirmed, waitlisted, detailImages);
}

export async function deleteEvent(orgId: string, eventId: string): Promise<boolean> {
  await safeDetachZoom(orgId, eventId);
  const rows = await db
    .delete(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .returning({ id: events.id });

  return rows.length > 0;
}

export async function duplicateEvent(
  orgId: string,
  createdById: string,
  eventId: string,
): Promise<EventDto | null> {
  const source = await getEvent(orgId, eventId);
  if (!source) return null;

  return createEvent(orgId, createdById, {
    title: `${source.title} Copy`,
    description: source.description,
    notes: source.notes,
    category: source.category,
    tags: source.tags,
    date: source.date,
    time: source.time,
    duration: source.duration,
    allDay: source.allDay,
    maxCapacity: source.maxCapacity,
    location: source.location,
    status: source.status,
    visibility: "unpublished",
    recurring: source.recurring,
    recurrenceFrequency: source.recurrenceFrequency,
    recurrenceDays: source.recurrenceDays,
    recurrenceInterval: source.recurrenceInterval,
    recurrenceEndDate: source.recurrenceEndDate,
    price: source.price,
    imageUrl: source.imageUrl,
  });
}

export async function listEventResources(
  orgId: string,
  eventId: string,
): Promise<EventResourceDto[]> {
  const rows = await db
    .select()
    .from(eventResources)
    .where(and(eq(eventResources.orgId, orgId), eq(eventResources.eventId, eventId)));

  return rows.map(toEventResourceDto);
}

export async function replaceEventResources(
  orgId: string,
  eventId: string,
  input: Array<{ resourceId: string; role: string; quantity?: number }>,
): Promise<EventResourceDto[] | "event_not_found" | "resource_not_found"> {
  const event = await getEvent(orgId, eventId);
  if (!event) return "event_not_found";

  const resourceIds = [...new Set(input.map((assignment) => assignment.resourceId))];
  if (resourceIds.length > 0) {
    const ownedResources = await db
      .select({ id: resources.id })
      .from(resources)
      .where(and(eq(resources.orgId, orgId), inArray(resources.id, resourceIds)));
    if (ownedResources.length !== resourceIds.length) return "resource_not_found";
  }

  await db
    .delete(eventResources)
    .where(and(eq(eventResources.orgId, orgId), eq(eventResources.eventId, eventId)));

  if (input.length === 0) return [];

  const rows = await db
    .insert(eventResources)
    .values(
      input.map((assignment) => ({
        orgId,
        eventId,
        resourceId: assignment.resourceId,
        role: assignment.role,
        quantity: assignment.quantity ?? 1,
      })),
    )
    .returning();

  return rows.map(toEventResourceDto);
}
