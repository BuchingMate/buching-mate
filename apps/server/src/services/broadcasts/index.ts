import type {
  BroadcastAudience,
  BroadcastDto,
  CreateBroadcastRequest,
  EmailBranding,
} from "@workspace/contracts";
import { renderBroadcastEmail } from "@workspace/contracts";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  attendees,
  broadcastRecipients,
  broadcasts,
  events,
  organization,
  registrations,
} from "../../db/schema";
import { sendBroadcastEmails } from "../email/mailer";
import { getOrgSettings } from "../org";
import { getUsage, incrementUsage, weekStart } from "../subscription-usage";

// Load what a send needs: the org name and branding that wrap the email, plus the
// org's effective weekly send cap.
async function loadSendContext(
  orgId: string,
): Promise<{ orgName: string; branding: EmailBranding; weeklyCap: number }> {
  const [orgRow, settings] = await Promise.all([
    db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1),
    getOrgSettings(orgId),
  ]);
  return {
    orgName: orgRow[0]?.name ?? "",
    branding: settings.emailBranding,
    weeklyCap: settings.broadcastWeeklyCap,
  };
}

type Recipient = { email: string; attendeeId: string | null };

// Sends to a specific event's guests are always free and uncounted; newsletters
// and all-attendee blasts count toward the weekly cap.
export function isBillableAudience(audience: BroadcastAudience): boolean {
  return audience.type !== "event_guests";
}

// True when sending `count` more would pass the weekly cap.
export function exceedsWeeklyCap(cap: number, used: number, count: number): boolean {
  return used + count > cap;
}

function toDto(row: typeof broadcasts.$inferSelect): BroadcastDto {
  return {
    id: row.id,
    kind: row.kind,
    eventId: row.eventId,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    status: row.status,
    audience: row.audience,
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBroadcasts(orgId: string): Promise<BroadcastDto[]> {
  const rows = await db.select().from(broadcasts).where(eq(broadcasts.orgId, orgId));
  return rows.map(toDto);
}

export async function getBroadcast(orgId: string, id: string): Promise<BroadcastDto | null> {
  const rows = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.orgId, orgId), eq(broadcasts.id, id)))
    .limit(1);
  return rows[0] ? toDto(rows[0]) : null;
}

// Create a draft broadcast. For an event-targeted audience, the event must belong
// to the org. Returns the draft, or an error code the caller maps to a response.
export async function createBroadcast(
  orgId: string,
  input: CreateBroadcastRequest,
): Promise<BroadcastDto | "invalid_event"> {
  const eventId = input.audience.type === "event_guests" ? input.audience.eventId : null;
  if (eventId) {
    const owned = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.orgId, orgId)))
      .limit(1);
    if (owned.length === 0) return "invalid_event";
  }

  const [row] = await db
    .insert(broadcasts)
    .values({
      orgId,
      eventId,
      kind: input.kind,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      audience: input.audience,
      status: "draft",
    })
    .returning();
  return toDto(row);
}

// Expand an audience into a de-duplicated recipient list.
async function resolveAudience(orgId: string, audience: BroadcastAudience): Promise<Recipient[]> {
  const rows =
    audience.type === "event_guests"
      ? await db
          .select({ email: attendees.email, attendeeId: attendees.id })
          .from(registrations)
          .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
          .where(
            and(
              eq(registrations.orgId, orgId),
              eq(registrations.eventId, audience.eventId),
              eq(registrations.status, "confirmed"),
            ),
          )
      : await db
          .select({ email: attendees.email, attendeeId: attendees.id })
          .from(attendees)
          .where(eq(attendees.orgId, orgId));

  const byEmail = new Map<string, Recipient>();
  for (const row of rows) {
    const email = row.email.toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, { email, attendeeId: row.attendeeId });
  }
  return [...byEmail.values()];
}

export type SendBroadcastResult =
  | { type: "sent"; broadcast: BroadcastDto }
  | { type: "not_found" }
  | { type: "invalid_state" }
  | { type: "no_recipients" }
  | { type: "cap_exceeded"; limit: number; used: number };

// Send a draft broadcast. For billable mail (newsletters / all-attendee blasts)
// it enforces the org's effective weekly cap and counts the real sends; sends to
// an event's own guests are free and uncounted. Expands recipients, sends in
// batches, then records per-recipient status. The paid add-on subscription, not
// per-send metering, is what bills the org.
export async function sendBroadcast(orgId: string, id: string): Promise<SendBroadcastResult> {
  const rows = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.orgId, orgId), eq(broadcasts.id, id)))
    .limit(1);
  const broadcast = rows[0];
  if (!broadcast) return { type: "not_found" };
  if (broadcast.status !== "draft") return { type: "invalid_state" };

  const recipients = await resolveAudience(orgId, broadcast.audience);
  if (recipients.length === 0) return { type: "no_recipients" };

  const ctx = await loadSendContext(orgId);
  const billable = isBillableAudience(broadcast.audience);
  const period = weekStart();
  const used = billable ? await getUsage(orgId, "broadcast_sends", period) : 0;
  if (billable && exceedsWeeklyCap(ctx.weeklyCap, used, recipients.length)) {
    return { type: "cap_exceeded", limit: ctx.weeklyCap, used };
  }

  // Claim the draft atomically. If another request already moved it out of
  // "draft", we get no row back and stop, so a broadcast never sends twice.
  const claimed = await db
    .update(broadcasts)
    .set({ status: "sending", recipientCount: recipients.length, updatedAt: new Date() })
    .where(and(eq(broadcasts.id, id), eq(broadcasts.status, "draft")))
    .returning({ id: broadcasts.id });
  if (claimed.length === 0) return { type: "invalid_state" };

  await db
    .insert(broadcastRecipients)
    .values(
      recipients.map((r) => ({ broadcastId: id, orgId, email: r.email, attendeeId: r.attendeeId })),
    )
    .onConflictDoNothing();

  const html = renderBroadcastEmail({
    subject: broadcast.subject,
    bodyHtml: broadcast.bodyHtml,
    orgName: ctx.orgName,
    branding: ctx.branding,
  });
  const result = await sendBroadcastEmails({
    orgId,
    recipients: recipients.map((r) => r.email),
    subject: broadcast.subject,
    html,
  });

  await Promise.all([
    markRecipients(id, result.sent, "sent"),
    markRecipients(id, result.failed, "failed"),
  ]);

  const sentCount = result.sent.length;
  if (billable && sentCount > 0) {
    await incrementUsage(db, orgId, "broadcast_sends", period, sentCount);
  }

  const status = sentCount === 0 ? "failed" : "sent";
  const [updated] = await db
    .update(broadcasts)
    .set({ status, sentCount, sentAt: new Date(), updatedAt: new Date() })
    .where(eq(broadcasts.id, id))
    .returning();

  return { type: "sent", broadcast: toDto(updated) };
}

async function markRecipients(
  broadcastId: string,
  emails: string[],
  status: "sent" | "failed",
): Promise<void> {
  if (emails.length === 0) return;
  await db
    .update(broadcastRecipients)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(broadcastRecipients.broadcastId, broadcastId),
        inArray(broadcastRecipients.email, emails),
      ),
    );
}
