import type {
  AttendeeDto,
  CreateRegistrationRequest,
  RegistrationDto,
  RegistrationWithEventDto,
  UpdateRegistrationRequest,
} from "@workspace/contracts";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db";
import { attendees, events, registrations } from "../../db/schema";
import { toEventDto } from "../events";
import { expireStalePendingPayments } from "../payments/expire";

export type CreateRegistrationOutcome =
  | { type: "created" | "resume"; registration: RegistrationDto }
  | "event_not_found"
  | "attendee_not_found"
  | "duplicate_registration";

export interface RegistrationWithAttendeeDto extends RegistrationDto {
  attendee: AttendeeDto;
}

export function toRegistrationDto(
  registration: typeof registrations.$inferSelect,
): RegistrationDto {
  return {
    id: registration.id,
    orgId: registration.orgId,
    eventId: registration.eventId,
    attendeeId: registration.attendeeId,
    status: registration.status,
    paymentStatus: registration.paymentStatus,
    checkoutSessionId: registration.checkoutSessionId,
    paymentIntentId: registration.paymentIntentId,
    paymentProvider: registration.paymentProvider,
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
  };
}

function toAttendeeDto(attendee: typeof attendees.$inferSelect): AttendeeDto {
  return {
    id: attendee.id,
    orgId: attendee.orgId,
    name: attendee.name,
    email: attendee.email,
    phone: attendee.phone,
    createdAt: attendee.createdAt.toISOString(),
    updatedAt: attendee.updatedAt.toISOString(),
  };
}

export async function listRegistrations(orgId: string): Promise<RegistrationDto[]> {
  await expireStalePendingPayments(orgId);
  const rows = await db.select().from(registrations).where(eq(registrations.orgId, orgId));
  return rows.map(toRegistrationDto);
}

export async function listRegistrationsByEvent(
  orgId: string,
  eventId: string,
): Promise<RegistrationWithAttendeeDto[]> {
  await expireStalePendingPayments(orgId, eventId);
  const rows = await db
    .select()
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .where(and(eq(registrations.orgId, orgId), eq(registrations.eventId, eventId)));

  return rows.map((row) => ({
    ...toRegistrationDto(row.registrations),
    attendee: toAttendeeDto(row.attendees),
  }));
}

export async function listRegistrationsByAttendee(
  orgId: string,
  attendeeId: string,
): Promise<RegistrationWithEventDto[]> {
  const rows = await db
    .select()
    .from(registrations)
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(and(eq(registrations.orgId, orgId), eq(registrations.attendeeId, attendeeId)));

  return rows.map((row) => ({
    ...toRegistrationDto(row.registrations),
    event: toEventDto(row.events),
  }));
}

export async function createRegistration(
  orgId: string,
  input: CreateRegistrationRequest,
): Promise<CreateRegistrationOutcome> {
  await expireStalePendingPayments(orgId, input.eventId);

  const eventRows = await db
    .select({ id: events.id, maxCapacity: events.maxCapacity, price: events.price })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, input.eventId)))
    .limit(1);
  if (!eventRows[0]) return "event_not_found";
  const event = eventRows[0];

  const attendeeRows = await db
    .select({ id: attendees.id })
    .from(attendees)
    .where(and(eq(attendees.orgId, orgId), eq(attendees.id, input.attendeeId)))
    .limit(1);
  if (!attendeeRows[0]) return "attendee_not_found";

  const existingRows = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.orgId, orgId),
        eq(registrations.eventId, input.eventId),
        eq(registrations.attendeeId, input.attendeeId),
        ne(registrations.status, "cancelled"),
      ),
    )
    .limit(1);

  const existing = existingRows[0];
  if (existing) {
    const stillResumable =
      existing.status === "pending" &&
      existing.paymentStatus === "pending" &&
      (!existing.paymentExpiresAt || existing.paymentExpiresAt.getTime() > Date.now());

    if (stillResumable) {
      return { type: "resume", registration: toRegistrationDto(existing) };
    }
    return "duplicate_registration";
  }

  // Paid events hold seat as `pending` until webhook confirms payment.
  // Free events go straight to `confirmed`. Capacity counts include both.
  const isPaid = Number(event.price) > 0;
  let status = input.status ?? (isPaid ? "pending" : "confirmed");
  if (
    (status === "confirmed" || status === "pending") &&
    event.maxCapacity !== null &&
    event.maxCapacity > 0
  ) {
    const activeCount = await db
      .select({ count: registrations.id })
      .from(registrations)
      .where(
        and(
          eq(registrations.orgId, orgId),
          eq(registrations.eventId, input.eventId),
          inArray(registrations.status, ["confirmed", "pending"]),
        ),
      );
    if (activeCount.length >= event.maxCapacity) {
      status = "waitlisted";
    }
  }

  let paymentStatus = input.paymentStatus ?? "not_required";
  if (paymentStatus === "not_required" && isPaid) {
    paymentStatus = "pending";
  }

  const rows = await db
    .insert(registrations)
    .values({
      orgId,
      eventId: input.eventId,
      attendeeId: input.attendeeId,
      status,
      paymentStatus,
    })
    .returning();

  return { type: "created", registration: toRegistrationDto(rows[0]) };
}

export async function updateRegistration(
  orgId: string,
  registrationId: string,
  input: UpdateRegistrationRequest,
): Promise<RegistrationDto | null> {
  const rows = await db
    .update(registrations)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(registrations.orgId, orgId), eq(registrations.id, registrationId)))
    .returning();

  return rows[0] ? toRegistrationDto(rows[0]) : null;
}

export async function deleteRegistration(orgId: string, registrationId: string): Promise<boolean> {
  const rows = await db
    .delete(registrations)
    .where(and(eq(registrations.orgId, orgId), eq(registrations.id, registrationId)))
    .returning({ id: registrations.id });

  return rows.length > 0;
}
