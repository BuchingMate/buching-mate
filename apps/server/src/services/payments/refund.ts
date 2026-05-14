import { and, eq } from "drizzle-orm";
import { isPaymentProvider } from "@workspace/contracts";
import { db } from "../../db";
import { paymentConnections, paymentRefunds, registrations } from "../../db/schema";
import { getAdapter } from "../../payments/registry";

export type RefundOutcome =
  | { type: "ok"; refundId: string; refundStatus: string }
  | {
      type: "error";
      code:
        | "registration_not_found"
        | "not_paid"
        | "no_provider"
        | "unknown_provider"
        | "adapter_failed";
      message: string;
    };

export async function refundRegistration(input: {
  orgId: string;
  registrationId: string;
  requestedByUserId: string;
  amount?: number;
  reason?: string;
}): Promise<RefundOutcome> {
  const regRows = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.orgId, input.orgId), eq(registrations.id, input.registrationId)))
    .limit(1);
  const reg = regRows[0];
  if (!reg) {
    return { type: "error", code: "registration_not_found", message: "Registration not found" };
  }
  if (reg.paymentStatus !== "paid") {
    return { type: "error", code: "not_paid", message: "Registration is not paid" };
  }
  if (!reg.paymentProvider || !reg.paymentIntentId) {
    return { type: "error", code: "no_provider", message: "Registration has no payment record" };
  }
  if (!isPaymentProvider(reg.paymentProvider)) {
    return { type: "error", code: "unknown_provider", message: "Unknown provider on registration" };
  }

  const connRows = await db
    .select()
    .from(paymentConnections)
    .where(
      and(
        eq(paymentConnections.orgId, input.orgId),
        eq(paymentConnections.provider, reg.paymentProvider),
      ),
    )
    .limit(1);
  const conn = connRows[0];
  if (!conn) {
    return { type: "error", code: "no_provider", message: "Provider not connected" };
  }

  const adapter = getAdapter(reg.paymentProvider);
  const idempotencyKey = crypto.randomUUID();
  const requestedAmount = input.amount ?? 0; // 0 = full refund (Stripe default)

  try {
    const result = await adapter.refundPayment(conn.accountId, {
      paymentReference: reg.paymentIntentId,
      amount:
        input.amount && input.amount > 0
          ? { amount: input.amount, currency: conn.currency }
          : undefined,
      reason: input.reason,
      idempotencyKey,
    });

    await db.insert(paymentRefunds).values({
      registrationId: reg.id,
      provider: reg.paymentProvider,
      providerRefundId: result.refundId,
      paymentReference: reg.paymentIntentId,
      requestedAmount,
      currency: conn.currency,
      reason: input.reason ?? null,
      status: result.status,
      rawResponse: result.raw,
      requestedByUserId: input.requestedByUserId,
    });

    return { type: "ok", refundId: result.refundId, refundStatus: result.status };
  } catch (err) {
    await db.insert(paymentRefunds).values({
      registrationId: reg.id,
      provider: reg.paymentProvider,
      providerRefundId: null,
      paymentReference: reg.paymentIntentId,
      requestedAmount,
      currency: conn.currency,
      reason: input.reason ?? null,
      status: "failed",
      failureReason: err instanceof Error ? err.message : String(err),
      requestedByUserId: input.requestedByUserId,
    });
    return {
      type: "error",
      code: "adapter_failed",
      message: err instanceof Error ? err.message : "refund failed",
    };
  }
}
