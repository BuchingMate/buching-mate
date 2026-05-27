// Sandbox probe for Polar's seat / member model — answers the open questions
// before we build seat assignment + a working customer portal. Read-only by
// default; pass flags to run the mutating probes.
//
// Run: cd apps/server && bun --env-file=../../.env scripts/polar-seat-probe.ts
//   [--assign <externalMemberId> <email>]   assign that member a seat (immediateClaim, no email)
//   [--bump <n>]                            try setting the sub seat quantity to n
//
// Needs POLAR_ACCESS_TOKEN (sandbox) + POLAR_PRODUCT_TEAM. Uses the first active
// subscription found for the Team product.

import { Polar } from "@polar-sh/sdk";

const token = process.env.POLAR_ACCESS_TOKEN;
if (!token) throw new Error("POLAR_ACCESS_TOKEN missing");
const teamProductId = process.env.POLAR_PRODUCT_TEAM;
if (!teamProductId) throw new Error("POLAR_PRODUCT_TEAM missing");
const server = (process.env.POLAR_ENVIRONMENT as "sandbox" | "production") ?? "sandbox";
const polar = new Polar({ accessToken: token, server });

const argv = process.argv.slice(2);
const assignIdx = argv.indexOf("--assign");
const assign = assignIdx >= 0 ? { externalMemberId: argv[assignIdx + 1], email: argv[assignIdx + 2] } : null;
const bumpIdx = argv.indexOf("--bump");
const bump = bumpIdx >= 0 ? Number(argv[bumpIdx + 1]) : null;

const log = (...a: unknown[]) => console.log(...a);
const ok = (m: string) => log(`  ✅ ${m}`);
const no = (m: string) => log(`  ❌ ${m}`);
async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  log(`\n=== ${label} ===`);
  try {
    return await fn();
  } catch (e) {
    no(`threw: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

log(`Polar server: ${server}`);

// 1. Is the Team product seat-based?
const product = await step("1. Team product pricing", async () => {
  const p = await polar.products.get({ id: teamProductId });
  const prices = (p.prices ?? []) as Array<{ amountType?: string }>;
  log(`  product: ${p.name} (org ${p.organizationId})`);
  log(`  price amountTypes: ${prices.map((x) => x.amountType).join(", ") || "(none)"}`);
  if (prices.some((x) => x.amountType === "seat_based")) ok("seat_based — model assumption holds");
  else no("NOT seat_based — revisit the model");
  return p;
});
const orgId = product?.organizationId;

// 2. Find an active Team subscription + its assigned seats.
const sub = await step("2. Active Team subscription + assigned seats", async () => {
  if (!orgId) return null;
  const res = await polar.subscriptions.list({ organizationId: orgId, productId: teamProductId, active: true });
  let found: { id: string; seats?: number | null; customerId: string } | null = null;
  for await (const page of res) {
    const item = page.result.items[0];
    if (item) {
      found = { id: item.id, seats: (item as { seats?: number | null }).seats, customerId: item.customerId };
      break;
    }
  }
  if (!found) {
    no("no active Team subscription found — do a sandbox Team checkout first, then re-run");
    return null;
  }
  log(`  sub ${found.id} — seats=${found.seats ?? "?"} customer=${found.customerId}`);
  return found;
});

// 2b. Assigned seats (separate so a scope error here doesn't lose the sub).
await step("2b. listSeats (assigned members)", async () => {
  if (!sub) return;
  const seats = await polar.customerSeats.listSeats({ subscriptionId: sub.id });
  const items = (seats as { seats?: unknown[] }).seats ?? [];
  log(`  assigned seats: ${items.length}`);
  if (items.length === 0) no("buyer NOT auto-assigned → we must assign the owner ourselves");
  else ok(`${items.length} member(s) already assigned`);
});

// 2c. Customer details (isolates whether only customer_seats scope is missing,
// and gives the externalId/email to use for the assign probe).
await step("2c. customers.get (owner externalId + email)", async () => {
  if (!sub) return;
  const c = await polar.customers.get({ id: sub.customerId });
  log(`  email=${c.email} externalId=${c.externalId ?? "(none)"}`);
  ok("customers:read works → it's specifically the customer_seats scope that's missing");
});

// 3. Reproduce the portal 500 (no member context).
await step("3. customerSessions.create WITHOUT member (expect 500)", async () => {
  if (!sub) return;
  const s = await polar.customerSessions.create({ customerId: sub.customerId });
  no(`unexpectedly succeeded: ${s.customerPortalUrl}`);
});

// 4. (mutating) assign a member, then session WITH member.
if (assign?.externalMemberId) {
  await step(`4. assignSeat(${assign.externalMemberId}) immediateClaim + session`, async () => {
    if (!sub) return;
    const seat = await polar.customerSeats.assignSeat({
      subscriptionId: sub.id,
      externalMemberId: assign.externalMemberId,
      email: assign.email,
      immediateClaim: true,
    });
    ok(`assigned seat status=${(seat as { status?: string }).status ?? "?"}`);
    const s = await polar.customerSessions.create({
      customerId: sub.customerId,
      externalMemberId: assign.externalMemberId,
    });
    ok(`portal URL: ${s.customerPortalUrl}`);
    log("  → check the assigned member's inbox: expect NO Polar invitation email (immediateClaim).");
  });
} else {
  log("\n(skip 4: pass --assign <externalMemberId> <email> to assign the owner + test the portal)");
}

// 5. (mutating) seat quantity update.
if (bump !== null) {
  await step(`5. subscriptions.update seats=${bump}`, async () => {
    if (!sub) return;
    await polar.subscriptions.update({ id: sub.id, subscriptionUpdate: { seats: bump } });
    ok(`seats updated to ${bump} (try a value below assigned to see the reduce guard)`);
  });
}

log("\nDone.");
process.exit(0);
