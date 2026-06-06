import type { EventDto, PublicRegistrationRequest, RegistrationDto } from "@workspace/contracts";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  attendees,
  events as eventsTable,
  organization,
  orgSettings,
  registrations,
} from "../../db/schema";
import { getEvent, listEvents } from "../events";
import { eventStartUtc, eventEndUtc } from "../../lib/event-time";
import { rewritePublicAssetUrl } from "../assets/public-url";
import { createRegistration, toRegistrationDto } from "../registrations";
import { sendBookingConfirmationEmail, sendBookingResumeEmail } from "../registrations/email";
import {
  addZoomRegistrant,
  cancelZoomRegistrant,
  getEventVideo,
  getJoinUrlForRegistration,
} from "../video";
import { createResumeToken } from "../payments/resume-token";

export async function getPublicOrg(slug: string) {
  const rows = await db.select().from(organization).where(eq(organization.slug, slug)).limit(1);
  const org = rows[0];
  if (!org) return null;

  const settingsRows = await db
    .select()
    .from(orgSettings)
    .where(eq(orgSettings.orgId, org.id))
    .limit(1);

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: rewritePublicAssetUrl(org.logo),
      createdAt: org.createdAt.toISOString(),
    },
    settings: settingsRows[0]
      ? {
          contactEmail: settingsRows[0].contactEmail,
          currency: settingsRows[0].currency,
          categories: settingsRows[0].categories,
        }
      : null,
  };
}

export async function listPublicEvents(slug: string) {
  const publicOrg = await getPublicOrg(slug);
  if (!publicOrg) return null;

  const rows = await listEvents(publicOrg.org.id);
  return rows.filter(isPublicEvent).map(stripPrivate);
}

function stripPrivate<T extends { notes: string | null }>(dto: T): T {
  return { ...dto, notes: null };
}

function isPublicEvent(event: EventDto) {
  return (
    event.visibility === "published" && event.status === "upcoming" && event.archivedAt === null
  );
}

export async function getPublicEvent(slug: string, eventId: string) {
  const publicOrg = await getPublicOrg(slug);
  if (!publicOrg) return null;

  const event = await getEvent(publicOrg.org.id, eventId);
  if (!event || !isPublicEvent(event)) return null;
  return stripPrivate(event);
}

export async function registerForPublicEvent(
  slug: string,
  eventId: string,
  input: PublicRegistrationRequest,
  publicOrigin: string,
  attendeeUserId?: string | null,
) {
  const publicOrg = await getPublicOrg(slug);
  if (!publicOrg) return "org_not_found";

  const event = await getPublicEvent(slug, eventId);
  if (!event) return "event_not_found";

  const email = input.email.trim().toLowerCase();
  const attendeeRows = await db
    .insert(attendees)
    .values({
      orgId: publicOrg.org.id,
      name: input.name,
      email,
      phone: input.phone ?? null,
      attendeeUserId: attendeeUserId ?? null,
    })
    .onConflictDoUpdate({
      target: [attendees.orgId, attendees.email],
      set: {
        name: input.name,
        phone: input.phone ?? null,
        ...(attendeeUserId ? { attendeeUserId } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  const outcome = await createRegistration(publicOrg.org.id, {
    eventId,
    attendeeId: attendeeRows[0].id,
  });

  if (typeof outcome === "string") return outcome;

  const isPaid = event.price > 0;
  if (isPaid) {
    const token = createResumeToken({
      registrationId: outcome.registration.id,
      eventId,
      orgSlug: slug,
    });
    const resumeUrl = `${publicOrigin}/events/${eventId}/resume?token=${encodeURIComponent(token)}`;
    void sendBookingResumeEmail({
      orgId: publicOrg.org.id,
      to: email,
      eventTitle: event.title,
      orgName: publicOrg.org.name,
      resumeUrl,
    });
  } else if (outcome.registration.status === "confirmed") {
    let joinUrl: string | null = null;
    try {
      joinUrl = await addZoomRegistrant(event.orgId, outcome.registration.id);
    } catch {
      // fall through to shared link
    }
    if (!joinUrl) {
      const video = await getEventVideo(event.orgId, event.id);
      joinUrl = video?.joinUrl ?? null;
    }
    const startUtc = eventStartUtc(event.date, event.time, event.timezone);
    const endUtc =
      eventEndUtc(event.endDate, event.endTime, event.timezone) ??
      new Date(startUtc.getTime() + Math.max(1, event.duration) * 60_000);
    void sendBookingConfirmationEmail({
      orgId: event.orgId,
      to: email,
      attendeeName: attendeeRows[0].name,
      eventTitle: event.title,
      orgName: publicOrg.org.name,
      timezone: event.timezone,
      location: event.location,
      registrationId: outcome.registration.id,
      joinUrl,
      startUtc,
      endUtc,
      eventId: event.id,
      description: event.description ?? null,
      manageUrl: `${publicOrigin}/me`,
    });
  }

  return outcome;
}

export interface MyRegistrationDto {
  registration: RegistrationDto;
  event: {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string | null;
    imageUrl: string | null;
  };
  org: {
    id: string;
    name: string;
    slug: string | null;
  };
}

export async function listMyRegistrations(email: string): Promise<MyRegistrationDto[]> {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({
      reg: registrations,
      event: eventsTable,
      org: organization,
    })
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .innerJoin(eventsTable, eq(registrations.eventId, eventsTable.id))
    .innerJoin(organization, eq(registrations.orgId, organization.id))
    .where(eq(attendees.email, normalized))
    .orderBy(desc(registrations.createdAt));

  return rows.map((row) => ({
    registration: toRegistrationDto(row.reg),
    event: {
      id: row.event.id,
      title: row.event.title,
      date: row.event.date,
      time: row.event.time,
      location: row.event.location,
      imageUrl: rewritePublicAssetUrl(row.event.imageUrl),
    },
    org: {
      id: row.org.id,
      name: row.org.name,
      slug: row.org.slug,
    },
  }));
}

export async function getJoinForMyRegistration(
  email: string,
  registrationId: string,
): Promise<{ joinUrl: string } | "not_found" | "forbidden" | "not_ready"> {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({ reg: registrations, attendee: attendees })
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .where(eq(registrations.id, registrationId))
    .limit(1);
  const found = rows[0];
  if (!found) return "not_found";
  if (found.attendee.email !== normalized) return "forbidden";
  if (found.reg.status !== "confirmed") return "not_ready";
  if (found.reg.paymentStatus !== "paid" && found.reg.paymentStatus !== "not_required") {
    return "not_ready";
  }
  const joinUrl = await getJoinUrlForRegistration(found.reg.orgId, found.reg.id);
  if (!joinUrl) return "not_found";
  return { joinUrl };
}

export async function cancelOwnRegistration(
  email: string,
  registrationId: string,
): Promise<RegistrationDto | "not_found" | "forbidden"> {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({ reg: registrations, attendee: attendees })
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .where(eq(registrations.id, registrationId))
    .limit(1);

  const found = rows[0];
  if (!found) return "not_found";
  if (found.attendee.email !== normalized) return "forbidden";

  const updated = await db
    .update(registrations)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(registrations.id, registrationId), eq(registrations.orgId, found.reg.orgId)))
    .returning();

  if (!updated[0]) return "not_found";
  try {
    await cancelZoomRegistrant(found.reg.orgId, registrationId);
  } catch {
    // best-effort
  }
  return toRegistrationDto(updated[0]);
}
