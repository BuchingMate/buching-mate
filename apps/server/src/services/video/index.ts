import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  attendees,
  eventRegistrants,
  eventVideo,
  events,
  registrations,
  videoConnections,
  zoomVideoAccounts,
} from "../../db/schema";
import { decrypt, encrypt } from "../../lib/crypto";
import { getLogger } from "../../observability/request-context";
import {
  type CreateMeetingInput,
  type UpdateMeetingInput,
  type VideoOAuthTokens,
  type VideoProvider,
  type ZoomAccountType,
} from "../../video/adapter";
import { getVideoAdapter } from "../../video/registry";

const REFRESH_LEEWAY_MS = 60_000;

export type VideoConnectionDto = {
  id: string;
  provider: VideoProvider;
  accountId: string;
  status: "active" | "revoked" | "error";
  email: string | null;
  accountType: ZoomAccountType;
  connectedAt: string;
  revokedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export type EventVideoDto = {
  eventId: string;
  provider: VideoProvider;
  meetingId: string;
  joinUrl: string;
};

function toConnectionDto(
  row: typeof videoConnections.$inferSelect,
  email: string | null,
  accountType: ZoomAccountType,
): VideoConnectionDto {
  const meta = row.metadata as { lastError?: string; lastErrorAt?: string };
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.accountId,
    status: row.status,
    email,
    accountType,
    connectedAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastError: meta?.lastError ?? null,
    lastErrorAt: meta?.lastErrorAt ?? null,
  };
}

export async function markConnectionError(
  orgId: string,
  provider: VideoProvider,
  errorMessage: string,
) {
  await db
    .update(videoConnections)
    .set({
      status: "error",
      metadata: { lastError: errorMessage, lastErrorAt: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(and(eq(videoConnections.orgId, orgId), eq(videoConnections.provider, provider)));
}

export async function markConnectionHealthy(orgId: string, provider: VideoProvider) {
  await db
    .update(videoConnections)
    .set({
      status: "active",
      metadata: {},
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(videoConnections.orgId, orgId),
        eq(videoConnections.provider, provider),
        eq(videoConnections.status, "error"),
      ),
    );
}

export async function getZoomConnection(orgId: string): Promise<VideoConnectionDto | null> {
  const rows = await db
    .select({
      conn: videoConnections,
      email: zoomVideoAccounts.email,
      accountType: zoomVideoAccounts.accountType,
    })
    .from(videoConnections)
    .leftJoin(zoomVideoAccounts, eq(zoomVideoAccounts.connectionId, videoConnections.id))
    .where(and(eq(videoConnections.orgId, orgId), eq(videoConnections.provider, "zoom")))
    .limit(1);
  if (!rows[0]) return null;
  return toConnectionDto(rows[0].conn, rows[0].email, rows[0].accountType ?? "basic");
}

export async function upsertZoomConnection(
  orgId: string,
  tokens: VideoOAuthTokens,
): Promise<VideoConnectionDto> {
  const existing = await db
    .select()
    .from(videoConnections)
    .where(and(eq(videoConnections.orgId, orgId), eq(videoConnections.provider, "zoom")))
    .limit(1);

  let connectionId: string;
  if (existing[0]) {
    const updated = await db
      .update(videoConnections)
      .set({
        accountId: tokens.zoomAccountId,
        status: "active",
        revokedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(videoConnections.id, existing[0].id))
      .returning();
    connectionId = updated[0]!.id;
  } else {
    const inserted = await db
      .insert(videoConnections)
      .values({
        orgId,
        provider: "zoom",
        accountId: tokens.zoomAccountId,
        status: "active",
      })
      .returning();
    connectionId = inserted[0]!.id;
  }

  const accessEnc = encrypt(tokens.accessToken);
  const refreshEnc = encrypt(tokens.refreshToken);
  const existingAccount = await db
    .select({ id: zoomVideoAccounts.id })
    .from(zoomVideoAccounts)
    .where(eq(zoomVideoAccounts.connectionId, connectionId))
    .limit(1);

  if (existingAccount[0]) {
    await db
      .update(zoomVideoAccounts)
      .set({
        zoomUserId: tokens.zoomUserId,
        zoomAccountId: tokens.zoomAccountId,
        email: tokens.email,
        accountType: tokens.accountType,
        accessTokenEncrypted: accessEnc,
        refreshTokenEncrypted: refreshEnc,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        updatedAt: new Date(),
      })
      .where(eq(zoomVideoAccounts.connectionId, connectionId));
  } else {
    await db.insert(zoomVideoAccounts).values({
      connectionId,
      zoomUserId: tokens.zoomUserId,
      zoomAccountId: tokens.zoomAccountId,
      email: tokens.email,
      accountType: tokens.accountType,
      accessTokenEncrypted: accessEnc,
      refreshTokenEncrypted: refreshEnc,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });
  }

  return (await getZoomConnection(orgId))!;
}

export async function disconnectZoom(orgId: string): Promise<boolean> {
  const rows = await db
    .delete(videoConnections)
    .where(and(eq(videoConnections.orgId, orgId), eq(videoConnections.provider, "zoom")))
    .returning({ id: videoConnections.id });
  return rows.length > 0;
}

export async function dropEventVideoByMeetingId(meetingId: string): Promise<void> {
  await db.delete(eventVideo).where(eq(eventVideo.externalMeetingId, meetingId));
}

export async function markZoomRevokedByZoomUser(zoomUserId: string): Promise<void> {
  const accountRows = await db
    .select({ connectionId: zoomVideoAccounts.connectionId })
    .from(zoomVideoAccounts)
    .where(eq(zoomVideoAccounts.zoomUserId, zoomUserId))
    .limit(1);
  const connectionId = accountRows[0]?.connectionId;
  if (!connectionId) return;
  await db.delete(videoConnections).where(eq(videoConnections.id, connectionId));
}

async function loadAccessToken(connectionId: string): Promise<string> {
  const rows = await db
    .select()
    .from(zoomVideoAccounts)
    .where(eq(zoomVideoAccounts.connectionId, connectionId))
    .limit(1);
  const account = rows[0];
  if (!account) throw new Error("zoom account missing for connection");

  if (account.tokenExpiresAt.getTime() - REFRESH_LEEWAY_MS > Date.now()) {
    return decrypt(account.accessTokenEncrypted);
  }
  const adapter = getVideoAdapter("zoom");
  const refreshed = await adapter.refreshAccessToken(decrypt(account.refreshTokenEncrypted));
  await db
    .update(zoomVideoAccounts)
    .set({
      accessTokenEncrypted: encrypt(refreshed.accessToken),
      refreshTokenEncrypted: encrypt(refreshed.refreshToken),
      tokenExpiresAt: refreshed.expiresAt,
      scopes: refreshed.scopes,
      updatedAt: new Date(),
    })
    .where(eq(zoomVideoAccounts.connectionId, connectionId));
  return refreshed.accessToken;
}

function combineEventStartUtc(event: typeof events.$inferSelect): Date {
  const time = event.time.length >= 5 ? event.time.slice(0, 5) : "00:00";
  return new Date(`${event.date}T${time}:00Z`);
}

const DAY_NAME_TO_ZOOM: Record<string, number> = {
  sun: 1, sunday: 1, "0": 1, "7": 1,
  mon: 2, monday: 2, "1": 2,
  tue: 3, tuesday: 3, tues: 3, "2": 3,
  wed: 4, wednesday: 4, "3": 4,
  thu: 5, thursday: 5, thur: 5, thurs: 5, "4": 5,
  fri: 6, friday: 6, "5": 6,
  sat: 7, saturday: 7, "6": 7,
};

function parseRecurrenceDays(days: string[]): number[] {
  const out = new Set<number>();
  for (const raw of days) {
    const key = raw.trim().toLowerCase();
    const n = DAY_NAME_TO_ZOOM[key];
    if (n) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

export function recurrenceForEvent(event: typeof events.$inferSelect) {
  if (!event.recurring || !event.recurrenceFrequency) return null;
  const freq = event.recurrenceFrequency.toLowerCase();
  if (freq !== "daily" && freq !== "weekly" && freq !== "monthly") return null;
  const interval = event.recurrenceInterval && event.recurrenceInterval > 0
    ? event.recurrenceInterval
    : 1;
  const recurrence: NonNullable<CreateMeetingInput["recurrence"]> = {
    frequency: freq,
    interval,
  };
  if (freq === "weekly") {
    const days = parseRecurrenceDays(event.recurrenceDays ?? []);
    if (days.length > 0) recurrence.weeklyDays = days;
  }
  if (freq === "monthly") {
    const dom = Number(event.date.split("-")[2]);
    if (Number.isFinite(dom)) recurrence.monthlyDay = dom;
  }
  if (event.recurrenceEndDate) {
    const end = new Date(`${event.recurrenceEndDate}T23:59:59Z`);
    if (!Number.isNaN(end.getTime())) recurrence.endDateUtc = end;
  }
  return recurrence;
}

function meetingInputForEvent(event: typeof events.$inferSelect): CreateMeetingInput {
  return {
    topic: event.title,
    startUtc: combineEventStartUtc(event),
    durationMinutes: Math.max(1, event.duration),
    agenda: event.description ?? null,
    recurrence: recurrenceForEvent(event),
  };
}

export async function attachZoomMeetingToEvent(
  orgId: string,
  eventId: string,
): Promise<EventVideoDto | null> {
  const eventRows = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1);
  const event = eventRows[0];
  if (!event) return null;

  const connRows = await db
    .select()
    .from(videoConnections)
    .where(and(eq(videoConnections.orgId, orgId), eq(videoConnections.provider, "zoom")))
    .limit(1);
  const connection = connRows[0];
  if (!connection || connection.status !== "active") return null;

  const existing = await db
    .select()
    .from(eventVideo)
    .where(eq(eventVideo.eventId, eventId))
    .limit(1);
  if (existing[0]) {
    return {
      eventId,
      provider: existing[0].provider,
      meetingId: existing[0].externalMeetingId,
      joinUrl: existing[0].joinUrl,
    };
  }

  const accessToken = await loadAccessToken(connection.id);
  const accountRows = await db
    .select({ accountType: zoomVideoAccounts.accountType })
    .from(zoomVideoAccounts)
    .where(eq(zoomVideoAccounts.connectionId, connection.id))
    .limit(1);
  const isLicensed = accountRows[0]?.accountType === "licensed";

  const adapter = getVideoAdapter("zoom");
  const created = await adapter.createMeeting(accessToken, {
    ...meetingInputForEvent(event),
    enableRegistration: isLicensed,
  });

  await db.insert(eventVideo).values({
    orgId,
    eventId,
    provider: "zoom",
    connectionId: connection.id,
    externalMeetingId: created.meetingId,
    externalMeetingUuid: created.meetingUuid,
    joinUrl: created.joinUrl,
    hostStartUrlEncrypted: created.hostStartUrl ? encrypt(created.hostStartUrl) : null,
    passcodeEncrypted: created.passcode ? encrypt(created.passcode) : null,
    registrationEnabled: created.registrationEnabled,
    raw: created.raw,
  });

  return {
    eventId,
    provider: "zoom",
    meetingId: created.meetingId,
    joinUrl: created.joinUrl,
  };
}

export async function syncZoomMeetingForEvent(
  orgId: string,
  eventId: string,
  patch: UpdateMeetingInput,
): Promise<void> {
  const rows = await db
    .select()
    .from(eventVideo)
    .where(and(eq(eventVideo.orgId, orgId), eq(eventVideo.eventId, eventId)))
    .limit(1);
  const link = rows[0];
  if (!link) return;
  const accessToken = await loadAccessToken(link.connectionId);
  const adapter = getVideoAdapter(link.provider);
  await adapter.updateMeeting(accessToken, link.externalMeetingId, patch);
  await db
    .update(eventVideo)
    .set({ updatedAt: new Date() })
    .where(eq(eventVideo.id, link.id));
}

export async function detachZoomMeetingFromEvent(
  orgId: string,
  eventId: string,
): Promise<void> {
  const rows = await db
    .select()
    .from(eventVideo)
    .where(and(eq(eventVideo.orgId, orgId), eq(eventVideo.eventId, eventId)))
    .limit(1);
  const link = rows[0];
  if (!link) return;
  try {
    const accessToken = await loadAccessToken(link.connectionId);
    const adapter = getVideoAdapter(link.provider);
    await adapter.deleteMeeting(accessToken, link.externalMeetingId);
  } catch {
    // best-effort: still drop local link
  }
  await db.delete(eventVideo).where(eq(eventVideo.id, link.id));
}

export async function getHostStartUrl(orgId: string, eventId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(eventVideo)
    .where(and(eq(eventVideo.orgId, orgId), eq(eventVideo.eventId, eventId)))
    .limit(1);
  const link = rows[0];
  if (!link || !link.hostStartUrlEncrypted) return null;
  return decrypt(link.hostStartUrlEncrypted);
}

export async function getEventVideo(
  orgId: string,
  eventId: string,
): Promise<EventVideoDto | null> {
  const rows = await db
    .select()
    .from(eventVideo)
    .where(and(eq(eventVideo.orgId, orgId), eq(eventVideo.eventId, eventId)))
    .limit(1);
  const link = rows[0];
  if (!link) return null;
  return {
    eventId: link.eventId,
    provider: link.provider,
    meetingId: link.externalMeetingId,
    joinUrl: link.joinUrl,
  };
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? "Attendee", lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export async function addZoomRegistrant(
  orgId: string,
  registrationId: string,
): Promise<string | null> {
  const rows = await db
    .select({
      reg: registrations,
      attendee: attendees,
      video: eventVideo,
    })
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .leftJoin(eventVideo, eq(eventVideo.eventId, registrations.eventId))
    .where(and(eq(registrations.orgId, orgId), eq(registrations.id, registrationId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!row.video) return null;
  if (!row.video.registrationEnabled) return row.video.joinUrl;

  const existing = await db
    .select()
    .from(eventRegistrants)
    .where(eq(eventRegistrants.registrationId, registrationId))
    .limit(1);
  if (existing[0]?.joinUrlEncrypted) {
    return decrypt(existing[0].joinUrlEncrypted);
  }

  const accessToken = await loadAccessToken(row.video.connectionId);
  const adapter = getVideoAdapter(row.video.provider);
  const { firstName, lastName } = splitName(row.attendee.name);
  let created;
  try {
    created = await adapter.createRegistrant(accessToken, {
      meetingId: row.video.externalMeetingId,
      email: row.attendee.email,
      firstName,
      lastName,
    });
  } catch (err) {
    getLogger().warn({ err, registrationId }, "video.zoom.createRegistrantFailed");
    return row.video.joinUrl;
  }

  if (existing[0]) {
    await db
      .update(eventRegistrants)
      .set({
        externalRegistrantId: created.registrantId,
        joinUrlEncrypted: encrypt(created.joinUrl),
        status: "registered",
        raw: created.raw,
        updatedAt: new Date(),
      })
      .where(eq(eventRegistrants.id, existing[0].id));
  } else {
    await db.insert(eventRegistrants).values({
      orgId,
      eventId: row.video.eventId,
      registrationId,
      provider: row.video.provider,
      externalRegistrantId: created.registrantId,
      joinUrlEncrypted: encrypt(created.joinUrl),
      email: row.attendee.email,
      firstName,
      lastName,
      status: "registered",
      raw: created.raw,
    });
  }
  return created.joinUrl;
}

export async function cancelZoomRegistrant(
  orgId: string,
  registrationId: string,
): Promise<void> {
  const rows = await db
    .select({
      reg: eventRegistrants,
      video: eventVideo,
    })
    .from(eventRegistrants)
    .innerJoin(eventVideo, eq(eventVideo.eventId, eventRegistrants.eventId))
    .where(
      and(
        eq(eventRegistrants.orgId, orgId),
        eq(eventRegistrants.registrationId, registrationId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return;
  if (row.reg.status === "cancelled") return;

  if (row.reg.externalRegistrantId) {
    try {
      const accessToken = await loadAccessToken(row.video.connectionId);
      const adapter = getVideoAdapter(row.video.provider);
      await adapter.cancelRegistrant(accessToken, {
        meetingId: row.video.externalMeetingId,
        registrantId: row.reg.externalRegistrantId,
        email: row.reg.email,
      });
    } catch (err) {
      getLogger().warn({ err, registrationId }, "video.zoom.cancelRegistrantFailed");
    }
  }
  await db
    .update(eventRegistrants)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(eventRegistrants.id, row.reg.id));
}

export async function getJoinUrlForRegistration(
  orgId: string,
  registrationId: string,
): Promise<string | null> {
  const regRows = await db
    .select({
      eventId: registrations.eventId,
    })
    .from(registrations)
    .where(and(eq(registrations.orgId, orgId), eq(registrations.id, registrationId)))
    .limit(1);
  if (!regRows[0]) return null;

  const personal = await db
    .select({ joinUrlEncrypted: eventRegistrants.joinUrlEncrypted, status: eventRegistrants.status })
    .from(eventRegistrants)
    .where(eq(eventRegistrants.registrationId, registrationId))
    .limit(1);
  if (personal[0]?.joinUrlEncrypted && personal[0].status !== "cancelled") {
    return decrypt(personal[0].joinUrlEncrypted);
  }
  const video = await getEventVideo(orgId, regRows[0].eventId);
  return video?.joinUrl ?? null;
}

export type AttendanceRow = {
  registrationId: string;
  email: string;
  name: string;
  status: "registered" | "cancelled" | "attended" | "no_show";
  attended: boolean;
  durationSeconds: number | null;
  joinTime: string | null;
  leaveTime: string | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  networkType: string | null;
};

export async function listAttendance(
  orgId: string,
  eventId: string,
): Promise<AttendanceRow[]> {
  const rows = await db
    .select({
      reg: registrations,
      attendee: attendees,
      part: eventRegistrants,
    })
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .leftJoin(eventRegistrants, eq(eventRegistrants.registrationId, registrations.id))
    .where(and(eq(registrations.orgId, orgId), eq(registrations.eventId, eventId)));

  return rows.map((row) => {
    const part = row.part;
    const status: AttendanceRow["status"] =
      part?.status ?? (row.reg.status === "cancelled" ? "cancelled" : "registered");
    return {
      registrationId: row.reg.id,
      email: row.attendee.email,
      name: row.attendee.name,
      status,
      attended: part?.attended ?? false,
      durationSeconds: part?.durationSeconds ?? null,
      joinTime: part?.joinTime?.toISOString() ?? null,
      leaveTime: part?.leaveTime?.toISOString() ?? null,
      ipAddress: part?.ipAddress ?? null,
      country: part?.country ?? null,
      city: part?.city ?? null,
      device: part?.device ?? null,
      networkType: part?.networkType ?? null,
    };
  });
}

export async function fetchAttendanceForMeetingUuid(meetingUuid: string): Promise<void> {
  const linkRows = await db
    .select()
    .from(eventVideo)
    .where(eq(eventVideo.externalMeetingUuid, meetingUuid))
    .limit(1);
  const link = linkRows[0];
  if (!link) return;

  const accessToken = await loadAccessToken(link.connectionId);
  const adapter = getVideoAdapter(link.provider);
  let participants;
  try {
    participants = await adapter.getPastParticipants(accessToken, meetingUuid);
  } catch (err) {
    getLogger().warn({ err, meetingUuid }, "video.zoom.fetchAttendanceFailed");
    return;
  }

  const existing = await db
    .select()
    .from(eventRegistrants)
    .where(eq(eventRegistrants.eventId, link.eventId));
  const byEmail = new Map(
    existing.map((row) => [row.email.toLowerCase(), row] as const),
  );
  const byRegistrant = new Map(
    existing
      .filter((row) => row.externalRegistrantId)
      .map((row) => [row.externalRegistrantId!, row] as const),
  );

  const matchedIds = new Set<string>();

  for (const p of participants) {
    const match =
      (p.registrantId && byRegistrant.get(p.registrantId)) ||
      (p.email && byEmail.get(p.email));
    if (!match) continue;
    matchedIds.add(match.id);
    const attendedDuration = p.durationSeconds ?? null;
    const wasAttended = (attendedDuration ?? 0) > 0;
    await db
      .update(eventRegistrants)
      .set({
        attended: wasAttended,
        joinTime: p.joinTime,
        leaveTime: p.leaveTime,
        durationSeconds: attendedDuration,
        ipAddress: p.ipAddress,
        country: p.country,
        city: p.city,
        device: p.device,
        networkType: p.networkType,
        status: wasAttended ? "attended" : match.status,
        updatedAt: new Date(),
      })
      .where(eq(eventRegistrants.id, match.id));
  }

  for (const row of existing) {
    if (matchedIds.has(row.id)) continue;
    if (row.status === "cancelled") continue;
    await db
      .update(eventRegistrants)
      .set({ status: "no_show", updatedAt: new Date() })
      .where(eq(eventRegistrants.id, row.id));
  }
}
