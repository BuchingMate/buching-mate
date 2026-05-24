import { Polar } from "@polar-sh/sdk";
import { count, eq } from "drizzle-orm";
import { BROADCAST_TIERS } from "@workspace/contracts";
import { db } from "../../db";
import { member, orgSettings, polarSubscriptions } from "../../db/schema";
import { logger } from "../../observability/logger";

export type OrgPlan = "free" | "team" | "enterprise";

// Maps a Polar product id to its broadcast capacity tier slug. Set from the
// POLAR_BROADCAST_TIERS env var, a JSON object of { "<productId>": "<slug>" }
// produced by scripts/polar-tiers-setup.ts.
function loadTierProductSlugs(): Record<string, string> {
  const raw = process.env.POLAR_BROADCAST_TIERS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    logger.error({ err }, "polar.broadcastTiers.parseFailed");
    return {};
  }
}

const TIER_PRODUCT_SLUGS = loadTierProductSlugs();

// True when a product id belongs to a broadcast capacity add-on, not the Team plan.
export function isBroadcastTierProduct(productId: string): boolean {
  return productId in TIER_PRODUCT_SLUGS;
}

// Weekly send cap a broadcast add-on product grants, or null if the id is not a
// known tier product.
export function broadcastCapForProduct(productId: string): number | null {
  const slug = TIER_PRODUCT_SLUGS[productId];
  if (!slug) return null;
  return BROADCAST_TIERS.find((t) => t.slug === slug)?.weeklyCap ?? null;
}

// The tier products to register as Polar checkout options, pairing each product
// id with its slug. Empty when POLAR_BROADCAST_TIERS is unset.
export function broadcastTierCheckoutProducts(): { productId: string; slug: string }[] {
  return Object.entries(TIER_PRODUCT_SLUGS).map(([productId, slug]) => ({ productId, slug }));
}

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

// Resolve the platform plan a product grants, or null when the product is not a
// recognized platform-plan product. Only the Team product is self-serve; Enterprise
// is always a custom per-customer deal and is set out-of-band, not inferred here.
// Email-plan products (broadcast tiers) are a separate product line, handled by the
// tier helpers above, never here.
export function planFromProductId(productId: string | null | undefined): OrgPlan | null {
  if (!productId) return null;
  if (productId === TEAM_PRODUCT_ID) return "team";
  return null;
}

export async function countOrgSeats(orgId: string): Promise<number> {
  const rows = await db.select({ n: count() }).from(member).where(eq(member.organizationId, orgId));
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
