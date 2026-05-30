import type {
  CreateEventRequest,
  EventDto,
  EventImageDto,
  EventResourceDto,
  UpdateEventRequest,
} from "@workspace/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  eventResources,
  events,
  publicAssets,
  resources,
  registrations,
  user,
} from "../../db/schema";
import { member } from "../../db/auth-schema";
import { WEB_URL } from "../../env";
import {
  sendEventReviewApprovedEmail,
  sendEventReviewRejectedEmail,
  sendEventReviewRequestedEmail,
} from "./email";
import { rewritePublicAssetUrl } from "../assets/public-url";
import {
  durationMinutes,
  eventEndUtc,
  eventStartUtc,
  utcToZonedWallClock,
} from "../../lib/event-time";
import { incrementUsage } from "../subscription-usage";
import { getLogger } from "../../observability/request-context";
import {
  attachZoomMeetingToEvent,
  detachZoomMeetingFromEvent,
  getEventVideo,
  markConnectionError,
  markConnectionHealthy,
  syncZoomMeetingForEvent,
} from "../video";

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Thrown by updateEvent when publishing is blocked pending an assigned review.
export class EventReviewRequiredError extends Error {
  constructor() {
    super("This event must be approved by its reviewer before it can be published");
    this.name = "EventReviewRequiredError";
  }
}

export class EventReviewerInvalidError extends Error {
  constructor() {
    super("Reviewer must be a member of this organization");
    this.name = "EventReviewerInvalidError";
  }
}

// Thrown when an end edit can't be resolved to a complete (date,time) pair —
// e.g. the client sent only endTime on an event that has no prior endDate.
export class EventEndIncompleteError extends Error {
  constructor() {
    super("endDate and endTime must be set together");
    this.name = "EventEndIncompleteError";
  }
}

async function ensureOrgReviewer(orgId: string, reviewerId: string | null | undefined) {
  if (!reviewerId) return;
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, reviewerId)))
    .limit(1);
  if (!rows[0]) throw new EventReviewerInvalidError();
}

async function getUserContact(userId: string): Promise<{ email: string; name: string } | null> {
  const rows = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

function adminEventUrl(eventId: string): string {
  return `${WEB_URL}/admin/events/${eventId}`;
}

async function notifyReviewer(
  eventId: string,
  reviewerId: string,
  submitterId: string | null,
  eventTitle: string,
) {
  try {
    const reviewer = await getUserContact(reviewerId);
    if (!reviewer) return;
    const submitter = submitterId ? await getUserContact(submitterId) : null;
    const orgRow = await db
      .select({ orgId: events.orgId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    if (!orgRow[0]) return;
    await sendEventReviewRequestedEmail({
      orgId: orgRow[0].orgId,
      to: reviewer.email,
      reviewerName: reviewer.name,
      submitterName: submitter?.name ?? "A teammate",
      eventTitle,
      eventUrl: adminEventUrl(eventId),
    });
  } catch (err) {
    getLogger().warn({ err, eventId }, "events.review.notifyFailed");
  }
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

// Keep `duration` and the explicit end consistent. If a valid explicit end is
// given it wins (duration is derived from it); otherwise end is derived from
// duration. Returns both so every write persists a consistent pair.
function reconcileSchedule(s: {
  date: string;
  time: string;
  duration: number;
  endDate: string | null;
  endTime: string | null;
  timezone: string;
}): { duration: number; endDate: string; endTime: string } {
  const startUtc = eventStartUtc(s.date, s.time, s.timezone);
  const endUtc = eventEndUtc(s.endDate, s.endTime, s.timezone);
  if (endUtc && endUtc.getTime() > startUtc.getTime()) {
    const wc = utcToZonedWallClock(endUtc, s.timezone);
    return { duration: durationMinutes(startUtc, endUtc), endDate: wc.date, endTime: wc.time };
  }
  const derivedEnd = new Date(startUtc.getTime() + Math.max(1, s.duration) * 60_000);
  const wc = utcToZonedWallClock(derivedEnd, s.timezone);
  return { duration: Math.max(1, s.duration), endDate: wc.date, endTime: wc.time };
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
    endDate: event.endDate,
    endTime: event.endTime,
    timezone: event.timezone,
    allDay: event.allDay,
    maxCapacity: event.maxCapacity,
    location: event.location,
    locationLat: event.locationLat,
    locationLng: event.locationLng,
    status: event.status,
    visibility: event.visibility,
    reviewerId: event.reviewerId,
    reviewStatus: event.reviewStatus,
    reviewNote: event.reviewNote,
    reviewedAt: event.reviewedAt?.toISOString() ?? null,
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

function withVideo(dto: EventDto, video: Awaited<ReturnType<typeof getEventVideo>>): EventDto {
  return {
    ...dto,
    video: video && {
      provider: video.provider,
      meetingId: video.meetingId,
      joinUrl: video.joinUrl,
    },
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
  const video = await getEventVideo(orgId, eventId);
  return withVideo(toEventDto(rows[0], confirmed, waitlisted, detailImages), video);
}

export async function createEvent(
  orgId: string,
  createdById: string,
  input: CreateEventRequest,
): Promise<EventDto> {
  await ensureOrgReviewer(orgId, input.reviewerId);
  if (input.visibility === "published" && input.reviewerId) {
    throw new EventReviewRequiredError();
  }

  const timezone = input.timezone ?? "UTC";
  const schedule = reconcileSchedule({
    date: input.date,
    time: input.time,
    duration: input.duration,
    endDate: input.endDate ?? null,
    endTime: input.endTime ?? null,
    timezone,
  });

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
        duration: schedule.duration,
        endDate: schedule.endDate,
        endTime: schedule.endTime,
        timezone,
        allDay: input.allDay ?? false,
        maxCapacity: input.maxCapacity ?? null,
        location: input.location ?? null,
        locationLat: input.locationLat ?? null,
        locationLng: input.locationLng ?? null,
        status: input.status ?? "upcoming",
        visibility: input.visibility ?? "unpublished",
        reviewerId: input.reviewerId ?? null,
        reviewStatus: input.reviewerId ? "pending" : "none",
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

  // videoProvider is authoritative: a Zoom meeting exists only when the creator
  // chose Zoom as the (virtual) location — regardless of publish state.
  if (input.videoProvider === "zoom" && rows[0].status !== "cancelled") {
    await safeAttachZoom(orgId, rows[0].id);
  }

  if (rows[0].reviewerId && rows[0].reviewStatus === "pending") {
    await notifyReviewer(rows[0].id, rows[0].reviewerId, createdById, rows[0].title);
  }

  const video = await getEventVideo(orgId, rows[0].id);
  return withVideo(toEventDto(rows[0], 0, 0), video);
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

  // videoProvider is not an events column — it drives Zoom attach/detach below.
  const { archivedAt, videoProvider, ...eventInput } = input;
  await ensureOrgReviewer(orgId, eventInput.reviewerId);
  const patch: Partial<typeof events.$inferInsert> = { ...eventInput, updatedAt: new Date() };
  if (archivedAt !== undefined) {
    patch.archivedAt = archivedAt === null ? null : new Date(archivedAt);
  }

  // Keep duration and explicit end consistent. Explicit end (if sent) wins;
  // otherwise a duration/date/time/timezone change re-derives the end.
  if (prev) {
    const endProvided = eventInput.endDate !== undefined || eventInput.endTime !== undefined;
    const scheduleChanged =
      endProvided ||
      eventInput.duration !== undefined ||
      eventInput.date !== undefined ||
      eventInput.time !== undefined ||
      eventInput.timezone !== undefined;
    if (scheduleChanged) {
      const timezone = eventInput.timezone ?? prev.timezone;
      const date = eventInput.date ?? prev.date;
      const time = eventInput.time ?? prev.time;
      let endDate: string | null;
      let endTime: string | null;
      let duration: number;
      if (endProvided) {
        endDate = eventInput.endDate !== undefined ? eventInput.endDate : prev.endDate;
        endTime = eventInput.endTime !== undefined ? eventInput.endTime : prev.endTime;
        // Partial end edits (one of the two fields, no fallback available) are
        // rejected so the client knows the value didn't land instead of being
        // silently coerced via the duration fallback.
        const hasEnd = endDate !== null && endTime !== null;
        const clearedEnd = endDate === null && endTime === null;
        if (!hasEnd && !clearedEnd) {
          throw new EventEndIncompleteError();
        }
        duration = prev.duration;
      } else {
        // No end fields in this PATCH. Preserve any explicit end the user
        // previously saved — reconcileSchedule will recompute duration from
        // (start, end) so the stored pair stays consistent. Only when there is
        // no prior explicit end do we re-derive end from the duration field.
        endDate = prev.endDate;
        endTime = prev.endTime;
        duration = eventInput.duration ?? prev.duration;
      }
      const schedule = reconcileSchedule({ date, time, duration, endDate, endTime, timezone });
      patch.duration = schedule.duration;
      patch.endDate = schedule.endDate;
      patch.endTime = schedule.endTime;
    }
  }

  // Review state transitions:
  //  - assigning a new non-null reviewer (or swapping to a different one): start
  //    a fresh review — pending status, clear prior note/timestamp, notify.
  //  - clearing the reviewer (X → null): drop the publish gate (reviewStatus =
  //    "none") but PRESERVE the reviewNote/reviewedAt as history. This keeps
  //    the UI's "Require approval" toggle from silently nuking reviewer
  //    feedback when it round-trips null → same reviewer.
  //  - no change: leave everything alone.
  let notifyNewReviewer: string | null = null;
  if (prev && eventInput.reviewerId !== undefined && eventInput.reviewerId !== prev.reviewerId) {
    if (eventInput.reviewerId) {
      patch.reviewStatus = "pending";
      patch.reviewNote = null;
      patch.reviewedAt = null;
      notifyNewReviewer = eventInput.reviewerId;
    } else {
      patch.reviewStatus = "none";
    }
  }

  // Publish gate: an event with an assigned reviewer can't be published until approved.
  if (prev) {
    const nextReviewerId =
      eventInput.reviewerId !== undefined ? eventInput.reviewerId : prev.reviewerId;
    const nextReviewStatus = (patch.reviewStatus as typeof prev.reviewStatus) ?? prev.reviewStatus;
    const nextVisibility = eventInput.visibility ?? prev.visibility;
    if (nextVisibility === "published" && nextReviewerId && nextReviewStatus !== "approved") {
      throw new EventReviewRequiredError();
    }
  }

  const rows = await db
    .update(events)
    .set(patch)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .returning();

  if (!rows[0]) return null;
  if (notifyNewReviewer && rows[0].reviewStatus === "pending") {
    await notifyReviewer(rows[0].id, notifyNewReviewer, rows[0].createdById, rows[0].title);
  }

  const next = rows[0];
  if (prev) {
    const currentVideo = await getEventVideo(orgId, next.id);
    const hasVideo = currentVideo != null;
    // videoProvider is authoritative when sent; otherwise leave the meeting as-is.
    // A cancelled event never keeps a meeting.
    const wantsZoom =
      next.status !== "cancelled" &&
      (videoProvider !== undefined ? videoProvider === "zoom" : hasVideo);

    if (wantsZoom && !hasVideo) {
      await safeAttachZoom(orgId, next.id);
    } else if (!wantsZoom && hasVideo) {
      await safeDetachZoom(orgId, next.id);
    } else if (wantsZoom && hasVideo) {
      const videoPatch: Parameters<typeof safeSyncZoom>[2] = {};
      if (prev.title !== next.title) videoPatch.topic = next.title;
      if (prev.duration !== next.duration) videoPatch.durationMinutes = next.duration;
      if (prev.description !== next.description) videoPatch.agenda = next.description ?? null;
      if (prev.date !== next.date || prev.time !== next.time || prev.timezone !== next.timezone) {
        videoPatch.startUtc = eventStartUtc(next.date, next.time, next.timezone);
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
  const video = await getEventVideo(orgId, eventId);
  return withVideo(toEventDto(rows[0], confirmed, waitlisted, detailImages), video);
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
    endDate: source.endDate,
    endTime: source.endTime,
    timezone: source.timezone,
    allDay: source.allDay,
    maxCapacity: source.maxCapacity,
    location: source.location,
    locationLat: source.locationLat,
    locationLng: source.locationLng,
    status: source.status,
    visibility: "unpublished",
    // Inherit the source's video setup so a duplicated Zoom event still gets
    // a meeting attached on create.
    videoProvider: source.video?.provider === "zoom" ? "zoom" : null,
    recurring: source.recurring,
    recurrenceFrequency: source.recurrenceFrequency,
    recurrenceDays: source.recurrenceDays,
    recurrenceInterval: source.recurrenceInterval,
    recurrenceEndDate: source.recurrenceEndDate,
    price: source.price,
    imageUrl: source.imageUrl,
  });
}

// Strict: only the user explicitly assigned as reviewer can approve or reject.
// No owner/admin override — admins can still reassign the reviewer via PATCH if
// they need to unblock a stalled review.
function canReview(actorUserId: string, reviewerId: string | null): boolean {
  return reviewerId !== null && actorUserId === reviewerId;
}

async function loadEventRow(orgId: string, eventId: string) {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Assign (or re-assign) a reviewer and put the event into pending review. */
export async function submitForReview(
  orgId: string,
  eventId: string,
  reviewerId: string,
  submitterId: string,
): Promise<EventDto | null> {
  await ensureOrgReviewer(orgId, reviewerId);
  const rows = await db
    .update(events)
    .set({
      reviewerId,
      reviewStatus: "pending",
      reviewNote: null,
      reviewedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .returning();
  if (!rows[0]) return null;
  await notifyReviewer(eventId, reviewerId, submitterId, rows[0].title);
  return getEvent(orgId, eventId);
}

export async function approveEvent(
  orgId: string,
  eventId: string,
  actorUserId: string,
): Promise<EventDto | "forbidden" | null> {
  const ev = await loadEventRow(orgId, eventId);
  if (!ev) return null;
  if (!canReview(actorUserId, ev.reviewerId)) return "forbidden";
  await db
    .update(events)
    .set({
      reviewStatus: "approved",
      reviewedAt: new Date(),
      reviewNote: null,
      updatedAt: new Date(),
    })
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)));
  if (ev.createdById) {
    try {
      const creator = await getUserContact(ev.createdById);
      const reviewer = await getUserContact(actorUserId);
      if (creator) {
        await sendEventReviewApprovedEmail({
          orgId,
          to: creator.email,
          reviewerName: reviewer?.name ?? "Your reviewer",
          eventTitle: ev.title,
          eventUrl: adminEventUrl(eventId),
        });
      }
    } catch (err) {
      getLogger().warn({ err, eventId }, "events.review.approveNotifyFailed");
    }
  }
  return getEvent(orgId, eventId);
}

export async function rejectEvent(
  orgId: string,
  eventId: string,
  actorUserId: string,
  note: string | null,
): Promise<EventDto | "forbidden" | null> {
  const ev = await loadEventRow(orgId, eventId);
  if (!ev) return null;
  if (!canReview(actorUserId, ev.reviewerId)) return "forbidden";
  await db
    .update(events)
    .set({
      reviewStatus: "rejected",
      reviewNote: note,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)));
  if (ev.createdById) {
    try {
      const creator = await getUserContact(ev.createdById);
      const reviewer = await getUserContact(actorUserId);
      if (creator) {
        await sendEventReviewRejectedEmail({
          orgId,
          to: creator.email,
          reviewerName: reviewer?.name ?? "Your reviewer",
          eventTitle: ev.title,
          note,
          eventUrl: adminEventUrl(eventId),
        });
      }
    } catch (err) {
      getLogger().warn({ err, eventId }, "events.review.rejectNotifyFailed");
    }
  }
  return getEvent(orgId, eventId);
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
