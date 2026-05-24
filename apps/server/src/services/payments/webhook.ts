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
import { addZoomRegistrant, cancelZoomRegistrant, getEventVideo } from "../video";

export type WebhookOutcome =
  | { type: "ok" }
  | { type: "ignored" }
  | { type: "duplicate" }
  | { type: "invalid_signature" }
  | { type: "unknown_provider" }
  | { type: "provider_not_configured" };

type ConfirmationEmail = {
  orgId: string;
  to: string;
  attendeeName: string;
  eventTitle: string;
  orgName: string;
  eventDate: string;
  eventTime: string;
  location: string | null;
  registrationId: string;
  joinUrl?: string | null;
  startUtc?: Date | null;
  endUtc?: Date | null;
  eventId?: string;
  description?: string | null;
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

    const applied = await applyEvent(tx, input.provider, normalized);
    return {
      type: "ok" as const,
      confirmation: applied.confirmation,
      cancelledRegistrations: applied.cancelledRegistrations,
    };
  });

  if (result.type === "duplicate") return { type: "duplicate" };

  if (result.confirmation) {
    await sendBookingConfirmationEmail(result.confirmation);
  }

  for (const { orgId, registrationId } of result.cancelledRegistrations) {
    try {
      await cancelZoomRegistrant(orgId, registrationId);
    } catch (err) {
      getLogger().warn({ err, orgId, registrationId }, "webhook.zoomCancelRegistrantFailed");
    }
  }

  return { type: "ok" };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AppliedEvent = {
  confirmation: ConfirmationEmail | null;
  cancelledRegistrations: Array<{ orgId: string; registrationId: string }>;
};

async function applyEvent(
  tx: Tx,
  provider: string,
  event: NormalizedPaymentEvent,
): Promise<AppliedEvent> {
  switch (event.type) {
    case "payment.completed": {
      const confirmation = await markPaid(tx, event);
      return { confirmation, cancelledRegistrations: [] };
    }
    case "payment.expired": {
      const cancelled = await markStatus(tx, event, {
        paymentStatus: "expired",
        status: "cancelled",
      });
      return { confirmation: null, cancelledRegistrations: cancelled };
    }
    case "payment.failed": {
      const cancelled = await markStatus(tx, event, {
        paymentStatus: "failed",
        status: "cancelled",
      });
      return { confirmation: null, cancelledRegistrations: cancelled };
    }
    case "payment.refunded": {
      const cancelled = await applyRefund(tx, provider, event);
      return { confirmation: null, cancelledRegistrations: cancelled };
    }
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
      orgId: registrations.orgId,
      eventId: registrations.eventId,
      duration: eventsTable.duration,
      description: eventsTable.description,
    })
    .from(registrations)
    .innerJoin(attendees, eq(registrations.attendeeId, attendees.id))
    .innerJoin(eventsTable, eq(registrations.eventId, eventsTable.id))
    .innerJoin(organization, eq(registrations.orgId, organization.id))
    .where(eq(registrations.id, registration.id))
    .limit(1);

  const details = detailRows[0];
  if (!details) return null;

  let joinUrl: string | null = null;
  try {
    joinUrl = await addZoomRegistrant(details.orgId, registration.id);
  } catch {
    // fall through
  }
  if (!joinUrl) {
    const video = await getEventVideo(details.orgId, details.eventId);
    joinUrl = video?.joinUrl ?? null;
  }
  const hhmm = details.eventTime.length >= 5 ? details.eventTime.slice(0, 5) : "00:00";
  const startUtc = new Date(`${details.eventDate}T${hhmm}:00Z`);
  const endUtc = new Date(startUtc.getTime() + Math.max(1, details.duration) * 60_000);
  const { duration: _d, ...emailFields } = details;
  return {
    ...emailFields,
    registrationId: registration.id,
    joinUrl,
    startUtc,
    endUtc,
  };
}

async function markStatus(
  tx: Tx,
  event: NormalizedPaymentEvent,
  set: { paymentStatus: "expired" | "failed"; status: "cancelled" },
): Promise<Array<{ orgId: string; registrationId: string }>> {
  const where = matchRegistration(event);
  if (!where) {
    logMatchMiss(event);
    return [];
  }
  const rows = await tx
    .update(registrations)
    .set({ ...set, updatedAt: new Date() })
    .where(where)
    .returning({ id: registrations.id, orgId: registrations.orgId });
  return rows.map((row) => ({ orgId: row.orgId, registrationId: row.id }));
}

async function applyRefund(
  tx: Tx,
  provider: string,
  event: Extract<NormalizedPaymentEvent, { type: "payment.refunded" }>,
): Promise<Array<{ orgId: string; registrationId: string }>> {
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
      return [];
    }
    const regRows = await tx
      .select({ id: registrations.id })
      .from(registrations)
      .where(where)
      .limit(1);
    const reg = regRows[0];
    if (!reg) {
      logMatchMiss(event);
      return [];
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
    if (!where) return [];
    const rows = await tx
      .update(registrations)
      .set({ paymentStatus: "refunded", updatedAt: new Date() })
      .where(where)
      .returning({ id: registrations.id, orgId: registrations.orgId });
    return rows.map((row) => ({ orgId: row.orgId, registrationId: row.id }));
  }
  return [];
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
