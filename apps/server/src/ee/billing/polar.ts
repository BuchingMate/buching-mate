import { Polar } from "@polar-sh/sdk";
import { and, count, eq, inArray } from "drizzle-orm";
import { BROADCAST_TIERS } from "@workspace/contracts";
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
