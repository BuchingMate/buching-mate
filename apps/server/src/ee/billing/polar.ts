import { Polar } from "@polar-sh/sdk";
import { count, eq } from "drizzle-orm";
import { db } from "../../db";
import { member, orgSettings, polarSubscriptions } from "../../db/schema";
import { logger } from "../../observability/logger";

export type OrgPlan = "free" | "team" | "enterprise";

let cached: Polar | null = null;

export function getPolarClient(): Polar | null {
  if (cached) return cached;
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) return null;
  cached = new Polar({
    accessToken: token,
    server: (process.env.POLAR_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
  });
  return cached;
}

export const TEAM_PRODUCT_ID = process.env.POLAR_PRODUCT_TEAM ?? "";

export function planFromProductId(productId: string | null | undefined): OrgPlan {
  if (!productId) return "free";
  if (productId === TEAM_PRODUCT_ID) return "team";
  return "team";
}

export async function countOrgSeats(orgId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(member)
    .where(eq(member.organizationId, orgId));
  return Math.max(1, rows[0]?.n ?? 1);
}

type TeamPricing = { pricePerSeatCents: number; currency: string } | null;
let teamPricingPromise: Promise<TeamPricing> | null = null;

export function getTeamPricing(): Promise<TeamPricing> {
  if (teamPricingPromise) return teamPricingPromise;
  const polar = getPolarClient();
  if (!polar || !TEAM_PRODUCT_ID) return Promise.resolve(null);
  teamPricingPromise = polar.products
    .get({ id: TEAM_PRODUCT_ID })
    .then((product) => {
      const price = product.prices?.[0] as
        | { priceAmount?: number; priceCurrency?: string }
        | undefined;
      if (!price || typeof price.priceAmount !== "number") return null;
      return {
        pricePerSeatCents: price.priceAmount,
        currency: price.priceCurrency ?? "usd",
      };
    })
    .catch((err) => {
      logger.error({ err }, "polar.getTeamPricing.failed");
      teamPricingPromise = null;
      return null;
    });
  return teamPricingPromise;
}

export async function syncSeatCount(orgId: string): Promise<void> {
  const polar = getPolarClient();
  if (!polar) return;

  const sub = await db
    .select()
    .from(polarSubscriptions)
    .where(eq(polarSubscriptions.orgId, orgId))
    .limit(1);
  const row = sub[0];
  if (!row || !row.polarSubscriptionId) return;

  const settings = await db
    .select({ plan: orgSettings.plan })
    .from(orgSettings)
    .where(eq(orgSettings.orgId, orgId))
    .limit(1);
  const plan = settings[0]?.plan ?? "free";
  if (plan === "free" || plan === "enterprise") return;
  if (row.status !== "active" && row.status !== "trialing") return;

  const seats = await countOrgSeats(orgId);
  if (seats === row.seatCount) return;

  try {
    await polar.subscriptions.update({
      id: row.polarSubscriptionId,
      subscriptionUpdate: { seats },
    });
    await db
      .update(polarSubscriptions)
      .set({ seatCount: seats, updatedAt: new Date() })
      .where(eq(polarSubscriptions.orgId, orgId));
  } catch (err) {
    logger.error({ err, orgId, seats }, "polar.syncSeatCount.failed");
  }
}
