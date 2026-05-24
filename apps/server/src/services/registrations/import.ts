import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { attendees, events, registrations } from "../../db/schema";
import { addZoomRegistrant } from "../video";
import { getLogger } from "../../observability/request-context";

export type ImportRow = {
  name: string;
  email: string;
  phone?: string | null;
};

export type ImportOutcome = {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function bulkImportRegistrations(
  orgId: string,
  eventId: string,
  rows: ImportRow[],
): Promise<ImportOutcome | "event_not_found"> {
  const eventRows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1);
  if (!eventRows[0]) return "event_not_found";

  const outcome: ImportOutcome = {
    total: rows.length,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const [idx, raw] of rows.entries()) {
    const rowNum = idx + 1;
    const email = raw.email?.trim().toLowerCase();
    const name = raw.name?.trim();

    if (!email || !isEmail(email)) {
      outcome.failed += 1;
      outcome.errors.push({ row: rowNum, email: email ?? "", reason: "invalid email" });
      continue;
    }
    if (!name) {
      outcome.failed += 1;
      outcome.errors.push({ row: rowNum, email, reason: "missing name" });
      continue;
    }

    try {
      const existingAttendee = await db
        .select({ id: attendees.id })
        .from(attendees)
        .where(and(eq(attendees.orgId, orgId), eq(attendees.email, email)))
        .limit(1);

      let attendeeId: string;
      if (existingAttendee[0]) {
        attendeeId = existingAttendee[0].id;
      } else {
        const inserted = await db
          .insert(attendees)
          .values({ orgId, name, email, phone: raw.phone ?? null })
          .returning({ id: attendees.id });
        attendeeId = inserted[0]!.id;
      }

      const existingReg = await db
        .select({ id: registrations.id, status: registrations.status })
        .from(registrations)
        .where(
          and(
            eq(registrations.orgId, orgId),
            eq(registrations.eventId, eventId),
            eq(registrations.attendeeId, attendeeId),
          ),
        )
        .limit(1);

      let registrationId: string;
      if (existingReg[0]) {
        if (existingReg[0].status !== "cancelled") {
          outcome.skipped += 1;
          continue;
        }
        const reactivated = await db
          .update(registrations)
          .set({
            status: "confirmed",
            paymentStatus: "not_required",
            updatedAt: new Date(),
          })
          .where(eq(registrations.id, existingReg[0].id))
          .returning({ id: registrations.id });
        registrationId = reactivated[0]!.id;
      } else {
        const inserted = await db
          .insert(registrations)
          .values({
            orgId,
            eventId,
            attendeeId,
            status: "confirmed",
            paymentStatus: "not_required",
          })
          .returning({ id: registrations.id });
        registrationId = inserted[0]!.id;
      }

      try {
        await addZoomRegistrant(orgId, registrationId);
      } catch (err) {
        getLogger().warn({ err, registrationId }, "import.zoomRegistrantFailed");
      }

      outcome.created += 1;
    } catch (err) {
      outcome.failed += 1;
      outcome.errors.push({
        row: rowNum,
        email,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return outcome;
}
