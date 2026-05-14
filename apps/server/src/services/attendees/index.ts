import type {
  AttendeeDto,
  CreateAttendeeRequest,
  UpdateAttendeeRequest,
} from "@workspace/contracts";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db";
import { attendees } from "../../db/schema";

export function toAttendeeDto(attendee: typeof attendees.$inferSelect): AttendeeDto {
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

export async function listAttendees(orgId: string, search: string | null): Promise<AttendeeDto[]> {
  const searchFilter = search
    ? or(ilike(attendees.name, `%${search}%`), ilike(attendees.email, `%${search}%`))
    : undefined;
  const rows = await db
    .select()
    .from(attendees)
    .where(
      searchFilter ? and(eq(attendees.orgId, orgId), searchFilter) : eq(attendees.orgId, orgId),
    );

  return rows.map(toAttendeeDto);
}

export async function getAttendee(orgId: string, attendeeId: string): Promise<AttendeeDto | null> {
  const rows = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.orgId, orgId), eq(attendees.id, attendeeId)))
    .limit(1);

  return rows[0] ? toAttendeeDto(rows[0]) : null;
}

export async function createAttendee(
  orgId: string,
  input: CreateAttendeeRequest,
): Promise<AttendeeDto> {
  const rows = await db
    .insert(attendees)
    .values({
      orgId,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      phone: input.phone ?? null,
    })
    .returning();

  return toAttendeeDto(rows[0]);
}

export async function updateAttendee(
  orgId: string,
  attendeeId: string,
  input: UpdateAttendeeRequest,
): Promise<AttendeeDto | null> {
  const patch: Partial<typeof attendees.$inferInsert> = { ...input, updatedAt: new Date() };
  if (typeof input.email === "string") patch.email = input.email.trim().toLowerCase();
  const rows = await db
    .update(attendees)
    .set(patch)
    .where(and(eq(attendees.orgId, orgId), eq(attendees.id, attendeeId)))
    .returning();

  return rows[0] ? toAttendeeDto(rows[0]) : null;
}
