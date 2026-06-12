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
import { PUBLIC_SITE_URL } from "../../env";
import { getJoinUrlForRegistration } from "../video";
import { getSuspendedOrgIds, sendTenantEmail } from "../email/mailer";
import {
  emailButton,
  escapeHtml,
  loadTenantBrand,
  renderEmailShell,
  renderEmailText,
  type EmailBrand,
} from "../email/shell";

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

// Exported for tests: pure render, no I/O.
export function renderReminderEmail(input: {
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  whenLabel: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  joinUrl: string | null;
  manageUrl: string | null;
  brand?: EmailBrand | null;
}): { html: string; text: string } {
  const brand = input.brand ?? { name: input.orgName, logoUrl: null, accentColor: null };
  const joinButton = input.joinUrl
    ? `<div style="margin:0 0 20px 0;">${emailButton(input.joinUrl, "Join meeting", "#2563eb")}<p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">${escapeHtml(input.joinUrl)}</p></div>`
    : "";
  const locationLabel = input.location ?? (input.joinUrl ? "Online" : "To be announced");
  const locationCell = input.location
    ? `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(input.location)}" style="color:#0f172a;text-decoration:underline;">${escapeHtml(input.location)}</a>`
    : escapeHtml(locationLabel);
  const detailRows = [
    ["Date", escapeHtml(input.dateLabel)],
    ["Time", escapeHtml(input.timeLabel)],
    ["Location", locationCell],
  ]
    .map(
      ([label, value], i, all) => `
                  <tr>
                    <td style="padding:${i === 0 ? "14px" : "8px"} 0 ${i === all.length - 1 ? "14px" : "8px"} 0;color:#64748b;font-size:14px;vertical-align:top;">${label}</td>
                    <td style="padding:${i === 0 ? "14px" : "8px"} 0 ${i === all.length - 1 ? "14px" : "8px"} 0;color:#0f172a;font-size:14px;text-align:right;">${value}</td>
                  </tr>`,
    )
    .join("");
  const manageLink = input.manageUrl
    ? `<a href="${escapeHtml(input.manageUrl)}" style="color:#475569;text-decoration:underline;">Manage your booking</a> &middot; `
    : "";
  const body = `
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">Reminder: ${escapeHtml(input.eventTitle)}</h1>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#475569;">Hi ${escapeHtml(input.attendeeName)}, your event ${escapeHtml(input.whenLabel)} at ${escapeHtml(input.orgName)}.</p>
                ${joinButton}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 24px 0;">
                  ${detailRows}
                </table>`;
  const html = renderEmailShell({
    brand,
    preheader: `${input.eventTitle} ${input.whenLabel} — ${input.dateLabel} · ${input.timeLabel}`,
    bodyHtml: body,
    footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;">${manageLink}Questions? Just reply to this email.</p>`,
  });
  const text = renderEmailText(
    [
      `Hi ${input.attendeeName}, your event ${input.whenLabel} at ${input.orgName}.`,
      "",
      `Event: ${input.eventTitle}`,
      `Date: ${input.dateLabel}`,
      `Time: ${input.timeLabel}`,
      `Location: ${locationLabel}`,
      input.joinUrl ? `Join: ${input.joinUrl}` : false,
      input.manageUrl ? `Manage your booking: ${input.manageUrl}` : false,
    ],
    brand,
  );
  return { html, text };
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
  const brand = await loadTenantBrand(input.orgId);
  const manageUrl = `${PUBLIC_SITE_URL}/me`;
  const rendered = renderReminderEmail({
    ...input,
    whenLabel,
    dateLabel,
    timeLabel,
    manageUrl,
    brand,
  });
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
    html: rendered.html,
    text: rendered.text,
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
