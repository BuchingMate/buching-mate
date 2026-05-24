import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orgSettings, polarSubscriptions } from "../../db/schema";
import { logger } from "../../observability/logger";
import {
  broadcastCapForProduct,
  isBroadcastTierProduct,
  planFromProductId,
  type OrgPlan,
} from "./polar";

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

// A subscription can declare its platform plan via metadata. This is how custom
// Enterprise deals work: their product/price is bespoke per customer (or ad-hoc on
// the checkout), so there is no stable product id to match. Set `plan` on the
// checkout and it carries onto the subscription.
export function planFromMetadata(meta: Record<string, unknown> | undefined | null): OrgPlan | null {
  const v = meta?.plan;
  return v === "team" || v === "enterprise" ? v : null;
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

// A broadcast capacity add-on is a separate subscription from the Team plan. It
// only sets the org's weekly send cap; it must not touch the Team subscription row
// or the org's plan. Cap applies while active, clears when the add-on ends.
async function applyBroadcastAddon(orgId: string, sub: PolarSubscriptionPayload) {
  const status = mapStatus(sub.status);
  const live = status === "active" || status === "trialing" || status === "past_due";
  const cap = live ? broadcastCapForProduct(sub.productId) : null;
  await db
    .update(orgSettings)
    .set({ broadcastWeeklyCap: cap, updatedAt: new Date() })
    .where(eq(orgSettings.orgId, orgId));
}

async function upsertSubscription(orgId: string, sub: PolarSubscriptionPayload) {
  // Email-plan product line: a broadcast capacity add-on only sets the weekly cap.
  if (isBroadcastTierProduct(sub.productId)) {
    await applyBroadcastAddon(orgId, sub);
    return;
  }
  // Platform-plan product line: resolve the plan from metadata first (custom
  // Enterprise), then the known Team product id. An unrecognized product must never
  // be assumed to be a plan, or it would clobber the org's plan and the single
  // subscription row.
  const planForProduct = planFromMetadata(sub.metadata) ?? planFromProductId(sub.productId);
  if (!planForProduct) {
    logger.warn({ subId: sub.id, productId: sub.productId }, "polar.webhook.unknownProduct");
    return;
  }
  const status = mapStatus(sub.status);
  const live = status === "active" || status === "trialing" || status === "past_due";
  const plan: OrgPlan = live ? planForProduct : "free";
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
