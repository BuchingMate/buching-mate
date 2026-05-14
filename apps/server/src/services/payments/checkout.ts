import { and, eq } from "drizzle-orm";
import { isPaymentProvider, type PaymentProvider } from "@workspace/contracts";
import { db } from "../../db";
import {
  attendeePaymentProfiles,
  attendees,
  events,
  organization,
  paymentConnections,
  registrations,
} from "../../db/schema";
import { getAdapter } from "../../payments/registry";

const CHECKOUT_TTL_MS = 31 * 60 * 1000;

export type CreateCheckoutOutcome =
  | { type: "ok"; url: string; sessionId: string }
  | {
      type: "error";
      code:
        | "registration_not_found"
        | "event_not_found"
        | "not_payable"
        | "no_provider"
        | "currency_mismatch";
      message: string;
    };

export async function createCheckoutForRegistration(input: {
  registrationId: string;
  orgSlug: string;
  successUrl: string;
  cancelUrl: string;
  preferredProvider?: string;
}): Promise<CreateCheckoutOutcome> {
  const orgRows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, input.orgSlug))
    .limit(1);
  if (!orgRows[0]) {
    return { type: "error", code: "registration_not_found", message: "Org not found" };
  }
  const orgId = orgRows[0].id;

  const regRows = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.id, input.registrationId), eq(registrations.orgId, orgId)))
    .limit(1);
  const registration = regRows[0];
  if (!registration) {
    return {
      type: "error",
      code: "registration_not_found",
      message: "Registration not found",
    };
  }

  if (registration.paymentStatus !== "pending" || registration.status !== "pending") {
    return {
      type: "error",
      code: "not_payable",
      message: "Registration is not awaiting payment",
    };
  }

  const eventRows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      price: events.price,
    })
    .from(events)
    .where(eq(events.id, registration.eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) {
    return { type: "error", code: "event_not_found", message: "Event not found" };
  }
  if (event.price <= 0) {
    return { type: "error", code: "not_payable", message: "Event is free" };
  }

  const connections = await db
    .select()
    .from(paymentConnections)
    .where(and(eq(paymentConnections.orgId, orgId), eq(paymentConnections.status, "active")));
  if (connections.length === 0) {
    return { type: "error", code: "no_provider", message: "No payment provider connected" };
  }

  let connection = connections[0];
  if (input.preferredProvider) {
    const match = connections.find((c) => c.provider === input.preferredProvider);
    if (!match) {
      return {
        type: "error",
        code: "no_provider",
        message: `Provider not connected: ${input.preferredProvider}`,
      };
    }
    connection = match;
  }
  if (!isPaymentProvider(connection.provider)) {
    return { type: "error", code: "no_provider", message: "Unknown provider" };
  }

  const provider: PaymentProvider = connection.provider;
  const adapter = getAdapter(provider);

  const customerId = await ensureCustomerProfile({
    adapter,
    accountId: connection.accountId,
    orgId,
    attendeeId: registration.attendeeId,
    provider,
  });

  const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);
  const idempotencyKey = crypto.randomUUID();

  const session = await adapter.createCheckout(connection.accountId, {
    orgId,
    eventId: event.id,
    registrationId: registration.id,
    title: event.title,
    description: event.description,
    amount: { amount: event.price, currency: connection.currency },
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    expiresAt,
    idempotencyKey,
    customerId,
  });

  await db
    .update(registrations)
    .set({
      paymentProvider: provider,
      checkoutSessionId: session.sessionId,
      paymentIdempotencyKey: idempotencyKey,
      paymentExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, registration.id));

  return { type: "ok", url: session.url, sessionId: session.sessionId };
}

async function ensureCustomerProfile(input: {
  adapter: ReturnType<typeof getAdapter>;
  accountId: string;
  orgId: string;
  attendeeId: string;
  provider: PaymentProvider;
}): Promise<string | undefined> {
  const existing = await db
    .select()
    .from(attendeePaymentProfiles)
    .where(
      and(
        eq(attendeePaymentProfiles.attendeeId, input.attendeeId),
        eq(attendeePaymentProfiles.provider, input.provider),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].providerCustomerId;

  const attendeeRows = await db
    .select({ id: attendees.id, email: attendees.email, name: attendees.name })
    .from(attendees)
    .where(eq(attendees.id, input.attendeeId))
    .limit(1);
  const attendee = attendeeRows[0];
  if (!attendee) return undefined;

  const created = await input.adapter.getOrCreateCustomer(input.accountId, {
    externalId: attendee.id,
    email: attendee.email,
    name: attendee.name,
    metadata: { orgId: input.orgId },
  });

  await db
    .insert(attendeePaymentProfiles)
    .values({
      attendeeId: attendee.id,
      orgId: input.orgId,
      provider: input.provider,
      providerCustomerId: created.customerId,
    })
    .onConflictDoNothing();

  return created.customerId;
}
