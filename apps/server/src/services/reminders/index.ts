import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  attendees,
  events as eventsTable,
  organization,
  registrationReminders,
  registrations,
} from "../../db/schema";
import { getLogger } from "../../observability/request-context";
import { buildEventIcs } from "../../lib/ics";
import { eventStartUtc, formatEventDateTime } from "../../lib/event-time";
import { getJoinUrlForRegistration } from "../video";
import { getSuspendedOrgIds, sendTenantEmail } from "../email/mailer";

const KIND_WINDOWS: Record<"t24h" | "t1h", { lookAheadMs: number; windowMs: number }> = {
  t24h: { lookAheadMs: 24 * 3600 * 1000, windowMs: 60 * 60 * 1000 },
  t1h: { lookAheadMs: 60 * 60 * 1000, windowMs: 30 * 60 * 1000 },
};

async function listDueRegistrations(kind: "t24h" | "t1h") {
  const { lookAheadMs, windowMs } = KIND_WINDOWS[kind];
  const now = Date.now();
  const lowerBound = new Date(now + lookAheadMs - windowMs);
  const upperBound = new Date(now + lookAheadMs + windowMs);

  const rows = await db
    .select({
      reg: registrations,
      event: eventsTable,
      attendee: attendees,
      org: organization,
    })
    .from(registrations)
    .innerJoin(eventsTable, eq(registrations.eventId, eventsTable.id))
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .innerJoin(organization, eq(registrations.orgId, organization.id))
    .where(
      and(
        eq(registrations.status, "confirmed"),
        inArray(registrations.paymentStatus, ["paid", "not_required"]),
        eq(eventsTable.status, "upcoming"),
        sql`(${eventsTable.date}::timestamp + ${eventsTable.time}::time)
            AT TIME ZONE ${eventsTable.timezone} BETWEEN ${lowerBound.toISOString()}::timestamptz AND ${upperBound.toISOString()}::timestamptz`,
      ),
    );

  if (rows.length === 0) return [];

  const regIds = rows.map((r) => r.reg.id);
  const alreadySent = await db
    .select({ registrationId: registrationReminders.registrationId })
    .from(registrationReminders)
    .where(
      and(
        inArray(registrationReminders.registrationId, regIds),
        eq(registrationReminders.kind, kind),
      ),
    );
  const sentSet = new Set(alreadySent.map((r) => r.registrationId));
  return rows.filter((r) => !sentSet.has(r.reg.id));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderReminderHtml(input: {
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  whenLabel: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  joinUrl: string | null;
}) {
  const joinButton = input.joinUrl
    ? `<a href="${input.joinUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:500;">Join meeting</a>`
    : "";
  const locationRow = input.location
    ? `<p style="margin:8px 0 0 0;font-size:14px;color:#475569;">Location: ${escapeHtml(input.location)}</p>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"><tr><td style="padding:32px;">
<h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;">Reminder: ${escapeHtml(input.eventTitle)}</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#475569;">Hi ${escapeHtml(input.attendeeName)}, your event ${escapeHtml(input.whenLabel)} at ${escapeHtml(input.orgName)}.</p>
<p style="margin:0 0 4px 0;font-size:14px;color:#475569;">${escapeHtml(input.dateLabel)} &middot; ${escapeHtml(input.timeLabel)}</p>
${locationRow}
<div style="margin:20px 0 0 0;">${joinButton}</div>
</td></tr></table></td></tr></table></body></html>`.trim();
}

async function sendReminder(input: {
  orgId: string;
  to: string;
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  kind: "t24h" | "t1h";
  timezone: string;
  location: string | null;
  joinUrl: string | null;
  startUtc: Date;
  endUtc: Date;
  eventId: string;
  description: string | null;
  registrationId: string;
}) {
  const whenLabel = input.kind === "t24h" ? "is tomorrow" : "starts in 1 hour";
  const { dateLabel, timeLabel } = formatEventDateTime(
    input.startUtc,
    input.endUtc,
    input.timezone,
  );
  const ics = buildEventIcs({
    uid: `${input.eventId}@buchingmate`,
    title: input.eventTitle,
    description: input.description,
    startUtc: input.startUtc,
    endUtc: input.endUtc,
    location: input.location,
    joinUrl: input.joinUrl,
    organizerEmail: null,
    organizerName: input.orgName,
  });
  await sendTenantEmail({
    orgId: input.orgId,
    kind: "event-reminder",
    to: input.to,
    subject:
      input.kind === "t24h"
        ? `Reminder: ${input.eventTitle} is tomorrow`
        : `Starting soon: ${input.eventTitle} in 1 hour`,
    html: renderReminderHtml({ ...input, whenLabel, dateLabel, timeLabel }),
    attachments: [
      {
        filename: "event.ics",
        contentType: "text/calendar",
        content: Buffer.from(ics, "utf8").toString("base64"),
      },
    ],
  });
}

export async function dispatchDueReminders(): Promise<{ sent: number }> {
  let sent = 0;
  for (const kind of ["t24h", "t1h"] as const) {
    const due = await listDueRegistrations(kind);
    if (due.length === 0) continue;
    const suspended = await getSuspendedOrgIds([...new Set(due.map((r) => r.reg.orgId))]);
    for (const row of due) {
      if (suspended.has(row.reg.orgId)) continue;
      const inserted = await db
        .insert(registrationReminders)
        .values({ registrationId: row.reg.id, kind })
        .onConflictDoNothing()
        .returning({ id: registrationReminders.id });
      if (inserted.length === 0) continue;

      const joinUrl = await getJoinUrlForRegistration(row.reg.orgId, row.reg.id);
      const start = eventStartUtc(row.event.date, row.event.time, row.event.timezone);
      const end = new Date(start.getTime() + Math.max(1, row.event.duration) * 60_000);
      await sendReminder({
        orgId: row.reg.orgId,
        to: row.attendee.email,
        attendeeName: row.attendee.name,
        eventTitle: row.event.title,
        orgName: row.org.name,
        kind,
        timezone: row.event.timezone,
        location: row.event.location,
        joinUrl,
        startUtc: start,
        endUtc: end,
        eventId: row.event.id,
        description: row.event.description ?? null,
        registrationId: row.reg.id,
      });
      sent += 1;
    }
  }
  return { sent };
}

let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(intervalMs = 5 * 60 * 1000) {
  if (reminderTimer) return;
  reminderTimer = setInterval(() => {
    void dispatchDueReminders().catch((err) =>
      getLogger().warn({ err }, "reminder dispatch failed"),
    );
  }, intervalMs);
}

export function stopReminderScheduler() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}
