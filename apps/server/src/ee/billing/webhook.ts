import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orgSettings, polarSubscriptions } from "../../db/schema";
import { logger } from "../../observability/logger";
import { planFromProductId, type OrgPlan } from "./polar";

type PolarSubscriptionPayload = {
  id: string;
  customerId: string;
  productId: string;
  status: string;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  seats?: number | null;
  metadata: Record<string, unknown>;
  endsAt?: Date | null;
};

type SubPayload = { data: PolarSubscriptionPayload };

function orgIdFromMetadata(meta: Record<string, unknown> | undefined | null): string | null {
  const v = meta?.orgId;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function mapStatus(s: string): "trialing" | "active" | "past_due" | "canceled" | "incomplete" {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "ended":
    case "revoked":
      return "canceled";
    default:
      return "incomplete";
  }
}

function statusToPlan(
  dbStatus: "trialing" | "active" | "past_due" | "canceled" | "incomplete",
  productId: string,
): OrgPlan {
  if (dbStatus === "active" || dbStatus === "trialing" || dbStatus === "past_due") {
    return planFromProductId(productId);
  }
  return "free";
}

async function upsertSubscription(orgId: string, sub: PolarSubscriptionPayload) {
  const status = mapStatus(sub.status);
  const plan = statusToPlan(status, sub.productId);
  const seats = sub.seats ?? 1;
  const now = new Date();

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(polarSubscriptions)
      .where(eq(polarSubscriptions.orgId, orgId))
      .limit(1);

    if (existing.length === 0) {
      await tx.insert(polarSubscriptions).values({
        orgId,
        polarCustomerId: sub.customerId,
        polarSubscriptionId: sub.id,
        polarProductId: sub.productId,
        status,
        seatCount: seats,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      });
    } else {
      await tx
        .update(polarSubscriptions)
        .set({
          polarCustomerId: sub.customerId,
          polarSubscriptionId: sub.id,
          polarProductId: sub.productId,
          status,
          seatCount: seats,
          currentPeriodEnd: sub.currentPeriodEnd,
          trialEndsAt: sub.trialEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          updatedAt: now,
        })
        .where(eq(polarSubscriptions.orgId, orgId));
    }

    await tx.update(orgSettings).set({ plan, updatedAt: now }).where(eq(orgSettings.orgId, orgId));
  });
}

export async function handleSubscriptionCreated(payload: SubPayload) {
  const orgId = orgIdFromMetadata(payload.data.metadata);
  if (!orgId) {
    logger.warn({ subId: payload.data.id }, "polar.webhook.missingOrgId");
    return;
  }
  await upsertSubscription(orgId, payload.data);
}

export async function handleSubscriptionUpdated(payload: SubPayload) {
  const orgId = orgIdFromMetadata(payload.data.metadata);
  if (!orgId) return;
  await upsertSubscription(orgId, payload.data);
}

export async function handleSubscriptionActive(payload: SubPayload) {
  const orgId = orgIdFromMetadata(payload.data.metadata);
  if (!orgId) return;
  await upsertSubscription(orgId, payload.data);
}

export async function handleSubscriptionCanceled(payload: SubPayload) {
  const orgId = orgIdFromMetadata(payload.data.metadata);
  if (!orgId) return;
  await upsertSubscription(orgId, payload.data);
}

export async function handleSubscriptionRevoked(payload: SubPayload) {
  const orgId = orgIdFromMetadata(payload.data.metadata);
  if (!orgId) return;
  await upsertSubscription(orgId, { ...payload.data, status: "revoked" });
}
