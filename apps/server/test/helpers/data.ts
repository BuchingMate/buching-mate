import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  attendees,
  events,
  orgSettings,
  registrations,
  resources,
} from "../../src/db/schema";
import type {
  EventStatus,
  EventVisibility,
  OrgPlan,
  RegistrationStatus,
  PaymentStatus,
  ResourceType,
} from "@workspace/contracts";

let counter = 0;
function uid() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export interface SeedEventOpts {
  title?: string;
  price?: number;
  maxCapacity?: number | null;
  status?: EventStatus;
  visibility?: EventVisibility;
  date?: string;
  time?: string;
  duration?: number;
  createdById?: string | null;
  tags?: string[];
}

export async function seedEvent(orgId: string, opts: SeedEventOpts = {}) {
  const rows = await db
    .insert(events)
    .values({
      orgId,
      title: opts.title ?? `Event ${uid()}`,
      date: opts.date ?? "2026-06-01",
      time: opts.time ?? "10:00:00",
      duration: opts.duration ?? 60,
      price: opts.price ?? 0,
      maxCapacity: opts.maxCapacity ?? null,
      status: opts.status ?? "upcoming",
      visibility: opts.visibility ?? "unpublished",
      tags: opts.tags ?? [],
      createdById: opts.createdById ?? null,
    })
    .returning();
  return rows[0];
}

export interface SeedAttendeeOpts {
  name?: string;
  email?: string;
}

export async function seedAttendee(orgId: string, opts: SeedAttendeeOpts = {}) {
  const rows = await db
    .insert(attendees)
    .values({
      orgId,
      name: opts.name ?? `Attendee ${uid()}`,
      email: opts.email ?? `att-${uid()}@example.com`,
    })
    .returning();
  return rows[0];
}

export interface SeedRegistrationOpts {
  status?: RegistrationStatus;
  paymentStatus?: PaymentStatus;
  paymentExpiresAt?: Date | null;
}

export interface SeedResourceOpts {
  type?: ResourceType;
  name?: string;
}

export async function seedResource(orgId: string, opts: SeedResourceOpts = {}) {
  const rows = await db
    .insert(resources)
    .values({
      orgId,
      type: opts.type ?? "instructor",
      name: opts.name ?? `Resource ${uid()}`,
    })
    .returning();
  return rows[0];
}

export async function seedRegistration(
  orgId: string,
  eventId: string,
  attendeeId: string,
  opts: SeedRegistrationOpts = {},
) {
  const rows = await db
    .insert(registrations)
    .values({
      orgId,
      eventId,
      attendeeId,
      status: opts.status ?? "confirmed",
      paymentStatus: opts.paymentStatus ?? "not_required",
      paymentExpiresAt: opts.paymentExpiresAt ?? null,
    })
    .returning();
  return rows[0];
}


export async function setOrgPlan(orgId: string, plan: OrgPlan) {
  const existing = await db
    .select({ id: orgSettings.id })
    .from(orgSettings)
    .where(eq(orgSettings.orgId, orgId))
    .limit(1);
  if (existing[0]) {
    await db.update(orgSettings).set({ plan }).where(eq(orgSettings.orgId, orgId));
  } else {
    await db.insert(orgSettings).values({ orgId, plan });
  }
}
