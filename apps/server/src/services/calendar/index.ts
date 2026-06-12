import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { calendarSubscriptions } from "../../db/schema";

// The org's Calendar is its marketing list. A subscription is per-org and
// explicit opt-in; "subscribed" rows are the only audience for marketing
// broadcasts. Subscribe/unsubscribe upsert the same (org, email) row so an
// address can flip state without piling up duplicates.

export type CalendarSource = "registration" | "org_page" | "email_link";

export async function subscribeToCalendar(input: {
  orgId: string;
  email: string;
  attendeeId?: string | null;
  source?: CalendarSource;
}): Promise<void> {
  const email = input.email.toLowerCase();
  await db
    .insert(calendarSubscriptions)
    .values({
      orgId: input.orgId,
      email,
      attendeeId: input.attendeeId ?? null,
      status: "subscribed",
      source: input.source ?? "registration",
    })
    .onConflictDoUpdate({
      target: [calendarSubscriptions.orgId, calendarSubscriptions.email],
      set: {
        status: "subscribed",
        // Keep the attendee link fresh when we learn it, but never null an
        // existing one on a later anonymous opt-in.
        ...(input.attendeeId ? { attendeeId: input.attendeeId } : {}),
        updatedAt: new Date(),
      },
    });
}

// Flip an existing or implied subscription to "unsubscribed". Idempotent: an
// address with no row gets one in the unsubscribed state, so a later re-import
// can't silently resurrect consent.
export async function unsubscribeFromCalendar(input: {
  orgId: string;
  email: string;
}): Promise<void> {
  const email = input.email.toLowerCase();
  await db
    .insert(calendarSubscriptions)
    .values({
      orgId: input.orgId,
      email,
      status: "unsubscribed",
      source: "email_link",
    })
    .onConflictDoUpdate({
      target: [calendarSubscriptions.orgId, calendarSubscriptions.email],
      set: { status: "unsubscribed", updatedAt: new Date() },
    });
}

// Active subscribers for an org — the marketing audience. Returns email +
// attendeeId so the send path can record per-recipient status.
export async function listCalendarSubscribers(
  orgId: string,
): Promise<Array<{ email: string; attendeeId: string | null }>> {
  const rows = await db
    .select({
      email: calendarSubscriptions.email,
      attendeeId: calendarSubscriptions.attendeeId,
    })
    .from(calendarSubscriptions)
    .where(
      and(eq(calendarSubscriptions.orgId, orgId), eq(calendarSubscriptions.status, "subscribed")),
    );
  return rows;
}

export async function isSubscribed(orgId: string, email: string): Promise<boolean> {
  const rows = await db
    .select({ status: calendarSubscriptions.status })
    .from(calendarSubscriptions)
    .where(
      and(
        eq(calendarSubscriptions.orgId, orgId),
        eq(calendarSubscriptions.email, email.toLowerCase()),
      ),
    )
    .limit(1);
  return rows[0]?.status === "subscribed";
}
