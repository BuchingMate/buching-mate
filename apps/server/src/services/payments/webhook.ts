import { and, eq, isNotNull, ne, or, type SQL } from "drizzle-orm";
import { isPaymentProvider } from "@workspace/contracts";
import { db } from "../../db";
import {
  attendees,
  events as eventsTable,
  organization,
  paymentRefunds,
  registrations,
  webhookEvents,
} from "../../db/schema";
import { getLogger } from "../../observability/request-context";
import { getAdapter, isAdapterAvailable } from "../../payments/registry";
import { InvalidSignatureError, type NormalizedPaymentEvent } from "../../payments/adapter";
import { sendBookingConfirmationEmail } from "../registrations/email";

export type WebhookOutcome =
  | { type: "ok" }
  | { type: "ignored" }
  | { type: "duplicate" }
  | { type: "invalid_signature" }
  | { type: "unknown_provider" }
  | { type: "provider_not_configured" };

type ConfirmationEmail = {
  to: string;
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  eventDate: string;
  eventTime: string;
  location: string | null;
  registrationId: string;
};

export async function handleWebhook(input: {
  provider: string;
  headers: Record<string, string | undefined>;
  rawBody: string;
}): Promise<WebhookOutcome> {
  if (!isPaymentProvider(input.provider)) {
    return { type: "unknown_provider" };
  }
  if (!isAdapterAvailable(input.provider)) {
    return { type: "provider_not_configured" };
  }
  const adapter = getAdapter(input.provider);

  let normalized: NormalizedPaymentEvent | null;
  try {
    normalized = await adapter.verifyAndParse(input.headers, input.rawBody);
  } catch (err) {
    if (err instanceof InvalidSignatureError) {
      getLogger().warn(
        { provider: input.provider, reason: err.message },
        "webhook.invalidSignature",
      );
      return { type: "invalid_signature" };
    }
    throw err;
  }
  if (!normalized) return { type: "ignored" };

  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(webhookEvents)
      .values({
        provider: input.provider,
        providerEventId: normalized.providerEventId,
        payload: { type: normalized.type } as Record<string, unknown>,
      })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });

    if (inserted.length === 0) {
      return { type: "duplicate" as const, confirmation: null };
    }

    const confirmation = await applyEvent(tx, input.provider, normalized);
    return { type: "ok" as const, confirmation };
  });

  if (result.type === "duplicate") return { type: "duplicate" };

  if (result.confirmation) {
    await sendBookingConfirmationEmail(result.confirmation);
  }

  return { type: "ok" };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyEvent(
  tx: Tx,
  provider: string,
  event: NormalizedPaymentEvent,
): Promise<ConfirmationEmail | null> {
  switch (event.type) {
    case "payment.completed":
      return await markPaid(tx, event);
    case "payment.expired":
      await markStatus(tx, event, { paymentStatus: "expired", status: "cancelled" });
      return null;
    case "payment.failed":
      await markStatus(tx, event, { paymentStatus: "failed", status: "cancelled" });
      return null;
    case "payment.refunded":
      await applyRefund(tx, provider, event);
      return null;
  }
}

async function markPaid(
  tx: Tx,
  event: Extract<NormalizedPaymentEvent, { type: "payment.completed" }>,
): Promise<ConfirmationEmail | null> {
  const where = matchRegistration(event);
  if (!where) {
    logMatchMiss(event);
    return null;
  }
  const rows = await tx
    .update(registrations)
    .set({
      paymentStatus: "paid",
      status: "confirmed",
      ...(event.paymentIntentId ? { paymentIntentId: event.paymentIntentId } : {}),
      updatedAt: new Date(),
    })
    .where(and(where, ne(registrations.paymentStatus, "paid")))
    .returning({ id: registrations.id });

  const registration = rows[0];
  if (!registration) return null;

  const detailRows = await tx
    .select({
      to: attendees.email,
      attendeeName: attendees.name,
      eventTitle: eventsTable.title,
      orgName: organization.name,
      eventDate: eventsTable.date,
      eventTime: eventsTable.time,
      location: eventsTable.location,
    })
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .innerJoin(eventsTable, eq(registrations.eventId, eventsTable.id))
    .innerJoin(organization, eq(registrations.orgId, organization.id))
    .where(eq(registrations.id, registration.id))
    .limit(1);

  const details = detailRows[0];
  if (!details) return null;

  return {
    ...details,
    registrationId: registration.id,
  };
}

async function markStatus(
  tx: Tx,
  event: NormalizedPaymentEvent,
  set: { paymentStatus: "expired" | "failed"; status: "cancelled" },
) {
  const where = matchRegistration(event);
  if (!where) {
    logMatchMiss(event);
    return;
  }
  await tx
    .update(registrations)
    .set({ ...set, updatedAt: new Date() })
    .where(where);
}

async function applyRefund(
  tx: Tx,
  provider: string,
  event: Extract<NormalizedPaymentEvent, { type: "payment.refunded" }>,
) {
  const existing = await tx
    .select()
    .from(paymentRefunds)
    .where(
      and(
        eq(paymentRefunds.provider, provider),
        eq(paymentRefunds.providerRefundId, event.providerRefundId),
      ),
    )
    .limit(1);

  const settled = event.amount?.amount ?? null;
  const status = event.status;
  const settledAt = status === "succeeded" || status === "failed" ? new Date() : null;

  if (existing[0]) {
    await tx
      .update(paymentRefunds)
      .set({
        settledAmount: settled ?? existing[0].settledAmount,
        status,
        settledAt,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.id, existing[0].id));
  } else {
    const where = matchRegistration(event);
    if (!where) {
      logMatchMiss(event);
      return;
    }
    const regRows = await tx
      .select({ id: registrations.id })
      .from(registrations)
      .where(where)
      .limit(1);
    const reg = regRows[0];
    if (!reg) {
      logMatchMiss(event);
      return;
    }

    await tx.insert(paymentRefunds).values({
      registrationId: reg.id,
      provider,
      providerRefundId: event.providerRefundId,
      paymentReference: event.paymentReference,
      requestedAmount: settled ?? 0,
      settledAmount: settled,
      currency: event.amount?.currency ?? "USD",
      status,
      settledAt,
    });
  }

  if (status === "succeeded") {
    const where = matchRegistration(event);
    if (!where) return;
    await tx
      .update(registrations)
      .set({ paymentStatus: "refunded", updatedAt: new Date() })
      .where(where);
  }
}

function matchRegistration(event: NormalizedPaymentEvent): SQL | null {
  const clauses: SQL[] = [];
  if (event.registrationId) {
    clauses.push(eq(registrations.id, event.registrationId));
  }
  if (event.paymentIntentId) {
    clauses.push(
      and(
        isNotNull(registrations.paymentIntentId),
        eq(registrations.paymentIntentId, event.paymentIntentId),
      )!,
    );
  }
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return or(...clauses)!;
}

function logMatchMiss(event: NormalizedPaymentEvent) {
  getLogger().warn(
    {
      type: event.type,
      providerEventId: event.providerEventId,
      registrationId: event.registrationId,
      paymentIntentId: event.paymentIntentId,
    },
    "webhook.matchMiss",
  );
}
