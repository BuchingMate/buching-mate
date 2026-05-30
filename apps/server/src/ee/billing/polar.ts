import { Polar } from "@polar-sh/sdk";
import { and, count, eq, inArray } from "drizzle-orm";
import {
  BROADCAST_TIERS,
  type BillingHistoryItem,
  type PlanPricing,
  type PlanPricingResponse,
} from "@workspace/contracts";
import { db } from "../../db";
import { member, orgSettings, polarSubscriptions } from "../../db/schema";
import { logger } from "../../observability/logger";

export type OrgPlan = "free" | "team" | "enterprise";

// A "seat" is a privileged slot. Only owner and admin members consume one; manager
// and viewer are unlimited and free on every plan.
export const SEATED_ROLES = ["owner", "admin"] as const;
export function isSeatedRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

// Seat allowances. Free is a hard cap (no buying). Team's $50 base includes 5 seats
// and each seat beyond is $10/mo; the purchased count lives on the Polar subscription.
export const FREE_SEAT_CAP = 3;
export const TEAM_INCLUDED_SEATS = 5;

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
export const TEAM_PRODUCT_ANNUAL_ID = process.env.POLAR_PRODUCT_TEAM_ANNUAL ?? "";

// Resolve the platform plan a product grants, or null when the product is not a
// recognized platform-plan product. Both the monthly and annual Team products grant
// Team; Enterprise is always a custom per-customer deal and is set out-of-band, not
// inferred here. Email-plan products (broadcast tiers) are a separate product line,
// handled by the tier helpers above, never here.
export function planFromProductId(productId: string | null | undefined): OrgPlan | null {
  if (!productId) return null;
  if (productId === TEAM_PRODUCT_ID) return "team";
  if (TEAM_PRODUCT_ANNUAL_ID && productId === TEAM_PRODUCT_ANNUAL_ID) return "team";
  return null;
}

// Minimal structural view of a Polar product's seat-based price, so the parser is
// testable with a plain object (the real SDK Product is cast to this).
type SeatTier = { minSeats: number; maxSeats: number | null; pricePerSeat: number };
type ProductForPricing = {
  recurringInterval: string | null;
  prices: Array<{
    amountType?: string;
    priceCurrency?: string;
    seatTiers?: { minimumSeats: number; tiers: SeatTier[] };
  }>;
};

// Derive the display pricing for the Team plan from a Polar product. Returns null
// when the product is not a recurring seat-based product (the card then hides the
// price and shows a generic CTA). Pure so it is unit-testable.
export function parseTeamPricing(product: ProductForPricing): PlanPricing | null {
  const interval = product.recurringInterval;
  if (interval !== "month" && interval !== "year") return null;
  const price = product.prices.find((p) => p.amountType === "seat_based" && p.seatTiers);
  if (!price?.seatTiers || price.seatTiers.tiers.length === 0) return null;
  const { minimumSeats, tiers } = price.seatTiers;
  const firstTier = tiers[0]!;
  const unbounded = tiers.find((t) => t.maxSeats === null) ?? tiers[tiers.length - 1]!;
  return {
    interval,
    includedSeats: minimumSeats,
    basePriceCents: minimumSeats * firstTier.pricePerSeat,
    extraSeatPriceCents: unbounded.pricePerSeat,
    currency: price.priceCurrency ?? "usd",
  };
}

// Live Team pricing, cached in-memory. Polar product prices are immutable and rarely
// change, so a long TTL is fine; on any fetch error we return a null entry so the UI
// degrades gracefully rather than failing the whole billing page.
const PRICING_TTL_MS = 60 * 60 * 1000;
let pricingCache: { value: PlanPricingResponse; expiresAt: number } | null = null;

async function fetchPricing(polar: Polar, productId: string): Promise<PlanPricing | null> {
  if (!productId) return null;
  try {
    const product = await polar.products.get({ id: productId });
    return parseTeamPricing(product as unknown as ProductForPricing);
  } catch (err) {
    logger.warn({ err, productId }, "polar.getTeamPricing.failed");
    return null;
  }
}

export async function getTeamPricing(): Promise<PlanPricingResponse> {
  if (pricingCache && pricingCache.expiresAt > Date.now()) return pricingCache.value;
  const polar = getPolarClient();
  if (!polar) {
    // No Polar configured at all — stable null result is fine to cache.
    const value: PlanPricingResponse = { monthly: null, annual: null };
    pricingCache = { value, expiresAt: Date.now() + PRICING_TTL_MS };
    return value;
  }
  // Fetch both in parallel; no data dependency.
  const [monthly, annual] = await Promise.all([
    fetchPricing(polar, TEAM_PRODUCT_ID),
    fetchPricing(polar, TEAM_PRODUCT_ANNUAL_ID),
  ]);
  const value: PlanPricingResponse = { monthly, annual };
  // Don't poison the cache for an hour on a transient Polar failure. If either
  // tier failed to resolve, skip caching so the next request retries.
  if (monthly !== null && annual !== null) {
    pricingCache = { value, expiresAt: Date.now() + PRICING_TTL_MS };
  }
  return value;
}

// Past charges for a Polar customer, newest first. Best-effort: returns [] on error
// so the billing page never hard-fails on history.
export async function listBillingHistory(customerId: string): Promise<BillingHistoryItem[]> {
  const polar = getPolarClient();
  if (!polar) return [];
  const items: BillingHistoryItem[] = [];
  try {
    const result = await polar.orders.list({ customerId });
    for await (const page of result) {
      for (const o of page.result.items) {
        items.push({
          id: o.id,
          date: o.createdAt.toISOString(),
          amountCents: o.totalAmount,
          currency: o.currency,
          status: o.status,
          paid: o.paid,
          invoiceAvailable: o.isInvoiceGenerated,
        });
      }
    }
  } catch (err) {
    logger.warn({ err, customerId }, "polar.listBillingHistory.failed");
  }
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return items;
}

// Resolve an order's invoice for download. Guards that the order belongs to the
// expected customer so one org can't fetch another's invoice. Invoice generation is
// async: when not yet generated we trigger it and report `pending` for the caller to
// retry shortly.
export type InvoiceResult =
  | { kind: "url"; url: string }
  | { kind: "pending" }
  | { kind: "not_found" }
  | { kind: "forbidden" };

export async function getInvoiceForOrder(
  orderId: string,
  expectedCustomerId: string,
): Promise<InvoiceResult> {
  const polar = getPolarClient();
  if (!polar) return { kind: "not_found" };
  let order;
  try {
    order = await polar.orders.get({ id: orderId });
  } catch {
    return { kind: "not_found" };
  }
  if (order.customerId !== expectedCustomerId) return { kind: "forbidden" };
  if (!order.isInvoiceGenerated) {
    try {
      await polar.orders.generateInvoice({ id: orderId });
    } catch (err) {
      logger.warn({ err, orderId }, "polar.generateInvoice.failed");
    }
    return { kind: "pending" };
  }
  const inv = await polar.orders.invoice({ id: orderId });
  return { kind: "url", url: inv.url };
}

// Count members that occupy a seat (owner/admin) in an org.
export async function countSeatedMembers(orgId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(member)
    .where(and(eq(member.organizationId, orgId), inArray(member.role, [...SEATED_ROLES])));
  return rows[0]?.n ?? 0;
}

// Decide whether a subscription's seat quantity needs pushing to Polar, and to
// what. Only runs for an active/trialing plan. `seatedCount` is the number of
// owner/admin members.
//
// Team seats are customer-owned (they buy/resize in Polar) and membership is capped
// at the purchased count, so we never auto-scale them down. We only enforce a floor:
// seats can't be below the current seated count — covers upgrading from a plan that
// already had more admins than the seats just purchased.
//
// Enterprise pins to its contracted limit, reverting any customer portal seat edit;
// left alone when uncapped. Free is not seat-billed.
//
// Never syncs when the target already matches stored seats (also the loop guard
// against our own subscription.updated webhook). Pure so the guard set is testable.
export function shouldSyncSeats(args: {
  plan: OrgPlan;
  status: string;
  storedSeats: number;
  seatedCount: number;
  enterpriseSeatLimit?: number | null;
}): { sync: boolean; seats: number } {
  const { plan, status, storedSeats, seatedCount, enterpriseSeatLimit = null } = args;
  if (status !== "active" && status !== "trialing") return { sync: false, seats: storedSeats };
  let target: number | null;
  if (plan === "team") target = seatedCount > storedSeats ? seatedCount : null;
  else if (plan === "enterprise") target = enterpriseSeatLimit;
  else target = null; // free: not billed per seat
  if (target === null || target === storedSeats) return { sync: false, seats: storedSeats };
  return { sync: true, seats: target };
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
    .select({ plan: orgSettings.plan, enterpriseSeatLimit: orgSettings.enterpriseSeatLimit })
    .from(orgSettings)
    .where(eq(orgSettings.orgId, orgId))
    .limit(1);
  const plan = settings[0]?.plan ?? "free";

  const seatedCount = await countSeatedMembers(orgId);
  const decision = shouldSyncSeats({
    plan,
    status: row.status,
    storedSeats: row.seatCount,
    seatedCount,
    enterpriseSeatLimit: settings[0]?.enterpriseSeatLimit ?? null,
  });
  if (!decision.sync) return;
  const seats = decision.seats;

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

// Resolve the seat cap for a plan. Free is a fixed hard cap. Team is the seats the
// customer purchased on Polar (falling back to the included count until a
// subscription exists). Enterprise is the contracted limit, or uncapped when none
// is set. Pure so the resolution is testable.
export function seatCapForPlan(args: {
  plan: OrgPlan;
  teamSeats: number | null;
  enterpriseSeatLimit: number | null;
}): number {
  const { plan, teamSeats, enterpriseSeatLimit } = args;
  if (plan === "free") return FREE_SEAT_CAP;
  if (plan === "team") return teamSeats ?? TEAM_INCLUDED_SEATS;
  return enterpriseSeatLimit ?? Number.MAX_SAFE_INTEGER;
}

// Purchased team seats — the seat quantity on the org's Polar subscription, which
// the customer buys and resizes. Caps team membership. Null when the org has no
// subscription row, which the membership limit treats as the minimum (owner only)
// until the customer purchases seats.
export async function teamSeatCount(orgId: string): Promise<number | null> {
  const rows = await db
    .select({
      seatCount: polarSubscriptions.seatCount,
      subId: polarSubscriptions.polarSubscriptionId,
    })
    .from(polarSubscriptions)
    .where(eq(polarSubscriptions.orgId, orgId))
    .limit(1);
  const row = rows[0];
  if (!row || !row.subId) return null;
  return row.seatCount;
}

// The current seat cap for an org, resolved from its plan and seat sources. The
// enterprise contracted limit is set out-of-band on org settings; it is both the
// membership cap and the seat reconcile target.
export async function seatCapFor(orgId: string): Promise<number> {
  const settings = await db
    .select({ plan: orgSettings.plan, enterpriseSeatLimit: orgSettings.enterpriseSeatLimit })
    .from(orgSettings)
    .where(eq(orgSettings.orgId, orgId))
    .limit(1);
  const plan = (settings[0]?.plan ?? "free") as OrgPlan;
  const teamSeats = plan === "team" ? await teamSeatCount(orgId) : null;
  return seatCapForPlan({
    plan,
    teamSeats,
    enterpriseSeatLimit: settings[0]?.enterpriseSeatLimit ?? null,
  });
}

// Current seat usage for an org: seated members in use, the cap, and the plan.
// `cap` is null when uncapped (enterprise with no contracted limit) so the UI can
// render "Unlimited" instead of a huge number.
export async function getSeatUsage(
  orgId: string,
): Promise<{ used: number; cap: number | null; plan: OrgPlan }> {
  const [used, cap, settings] = await Promise.all([
    countSeatedMembers(orgId),
    seatCapFor(orgId),
    db
      .select({ plan: orgSettings.plan })
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1),
  ]);
  const plan = (settings[0]?.plan ?? "free") as OrgPlan;
  return { used, cap: cap >= Number.MAX_SAFE_INTEGER ? null : cap, plan };
}

// Throw when adding/promoting a member into `role` would exceed the org's seat cap.
// No-op for unseated roles (manager/viewer are unlimited). Callers must only invoke
// this for a member that is not already seated, so a seated→seated change is allowed.
//
// Not race-proof: better-auth adds members non-transactionally (count → this hook →
// insert), so simultaneous admin-adds to the same org can both pass and exceed the
// cap by one or two. Accepted as rare; see 06-seat-billing.md.
export async function assertSeatAvailableForRole(orgId: string, role: string): Promise<void> {
  if (!isSeatedRole(role)) return;
  const [used, cap] = await Promise.all([countSeatedMembers(orgId), seatCapFor(orgId)]);
  if (used >= cap) {
    throw new Error(
      `Admin seat limit reached (${cap}). Upgrade your plan or buy more seats to add another owner or admin.`,
    );
  }
}

// Ensure a member occupies a Polar seat on the subscription. A seat-based ("team")
// customer has no portal session until at least one member exists, so we assign the
// billing owner. `immediateClaim` claims the seat via the API without sending Polar's
// invitation email (so it never collides with our own invite flow). Best-effort and
// idempotent: re-assigning an already-claimed member is a no-op we ignore.
export async function ensureSeatAssigned(args: {
  subscriptionId: string;
  externalMemberId: string;
  email: string;
}): Promise<void> {
  const polar = getPolarClient();
  if (!polar) return;
  try {
    await polar.customerSeats.assignSeat({
      subscriptionId: args.subscriptionId,
      externalMemberId: args.externalMemberId,
      email: args.email,
      immediateClaim: true,
    });
  } catch (err) {
    logger.warn({ err, subscriptionId: args.subscriptionId }, "polar.ensureSeatAssigned.skip");
  }
}

// Create a customer-portal session scoped to a member and return its URL. Member
// context is required for team (seat-based) customers, which is why the better-auth
// plugin's own portal endpoint 500s for them.
export async function createPortalUrl(args: {
  customerId: string;
  externalMemberId: string;
}): Promise<string | null> {
  const polar = getPolarClient();
  if (!polar) return null;
  const session = await polar.customerSessions.create({
    customerId: args.customerId,
    externalMemberId: args.externalMemberId,
  });
  return session.customerPortalUrl;
}
