import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import type { SubscriptionInfo } from "@workspace/contracts";
import { db } from "../db";
import { orgSettings, polarSubscriptions } from "../db/schema";
import {
  createPortalUrl,
  ensureSeatAssigned,
  getInvoiceForOrder,
  getTeamPricing,
  listBillingHistory,
} from "../ee/billing/polar";

// The org's Polar customer id, or null when it has no subscription row yet.
async function customerIdForOrg(orgId: string): Promise<string | null> {
  const rows = await db
    .select({ customerId: polarSubscriptions.polarCustomerId })
    .from(polarSubscriptions)
    .where(eq(polarSubscriptions.orgId, orgId))
    .limit(1);
  return rows[0]?.customerId ?? null;
}

// Returns a Polar customer-portal URL for the org's subscription (manage seats,
// payment method, cancel). Owner-only: the session is scoped to the billing owner,
// who is the seat-based customer's member. We assign that seat lazily here so the
// portal works for subscriptions created before this flow existed.
export const billingRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg, requireRole("owner"))
  .get("/portal", async (c) => {
    const owner = c.var.user;
    const rows = await db
      .select({
        subId: polarSubscriptions.polarSubscriptionId,
        customerId: polarSubscriptions.polarCustomerId,
      })
      .from(polarSubscriptions)
      .where(eq(polarSubscriptions.orgId, c.var.orgId))
      .limit(1);
    const sub = rows[0];
    if (!sub?.subId || !sub.customerId) {
      return apiError(c, 400, "no_subscription", "No subscription to manage");
    }

    await ensureSeatAssigned({
      subscriptionId: sub.subId,
      externalMemberId: owner.id,
      email: owner.email,
    });
    const url = await createPortalUrl({ customerId: sub.customerId, externalMemberId: owner.id });
    if (!url) return apiError(c, 502, "portal_unavailable", "Could not open the billing portal");
    return c.json({ url });
  })
  // Current subscription summary (plan, interval, renewal) for the plan card.
  .get("/subscription", async (c) => {
    const planRows = await db
      .select({ plan: orgSettings.plan })
      .from(orgSettings)
      .where(eq(orgSettings.orgId, c.var.orgId))
      .limit(1);
    const subRows = await db
      .select({
        status: polarSubscriptions.status,
        interval: polarSubscriptions.recurringInterval,
        currentPeriodEnd: polarSubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: polarSubscriptions.cancelAtPeriodEnd,
      })
      .from(polarSubscriptions)
      .where(eq(polarSubscriptions.orgId, c.var.orgId))
      .limit(1);
    const sub = subRows[0];
    const info: SubscriptionInfo = {
      plan: planRows[0]?.plan ?? "free",
      status: sub?.status ?? null,
      interval: sub?.interval === "month" || sub?.interval === "year" ? sub.interval : null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    };
    return c.json(info);
  })
  // Live Team plan pricing (cached server-side) for the upgrade card.
  .get("/pricing", async (c) => c.json(await getTeamPricing()))
  // Past charges for the org, newest first.
  .get("/history", async (c) => {
    const customerId = await customerIdForOrg(c.var.orgId);
    if (!customerId) return c.json({ items: [] });
    return c.json({ items: await listBillingHistory(customerId) });
  })
  // Download link for one order's invoice. Generates it on demand (async) when not
  // yet available, returning 202 for the client to retry.
  .get("/invoice/:orderId", async (c) => {
    const customerId = await customerIdForOrg(c.var.orgId);
    if (!customerId) return apiError(c, 400, "no_subscription", "No subscription to manage");
    const result = await getInvoiceForOrder(c.req.param("orderId"), customerId);
    switch (result.kind) {
      case "url":
        return c.json({ url: result.url });
      case "pending":
        return c.json({ status: "pending" }, 202);
      case "forbidden":
        return apiError(c, 403, "forbidden", "That invoice does not belong to this organization");
      default:
        return apiError(c, 404, "not_found", "Order not found");
    }
  });
