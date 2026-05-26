// Set the contracted seat cap (owner+admin) for an enterprise org, out-of-band.
// The seat cap is read from org_settings.enterprise_seat_limit by the membership
// hooks and the seat reconcile (see .plans/04-commercial/06-seat-billing.md).
//
// Run: cd apps/server && bun --env-file=../../.env scripts/set-enterprise-seats.ts <orgSlugOrId> <seats>
// Pass `--plan` to also flip the org's plan to "enterprise" (cap only applies on the
// enterprise plan). Pass seats `null` to clear the cap (uncapped).

import { eq, or } from "drizzle-orm";
import { db } from "../src/db";
import { organization } from "../src/db/auth-schema";
import { orgSettings } from "../src/db/schema";

const [orgRef, seatsArg, ...flags] = process.argv.slice(2);
if (!orgRef || !seatsArg) {
  throw new Error("Usage: set-enterprise-seats.ts <orgSlugOrId> <seats|null> [--plan]");
}

const seats = seatsArg === "null" ? null : Number(seatsArg);
if (seats !== null && (!Number.isInteger(seats) || seats < 1)) {
  throw new Error(`Invalid seats "${seatsArg}": expected a positive integer or "null"`);
}
const alsoSetPlan = flags.includes("--plan");

const orgs = await db
  .select({ id: organization.id, slug: organization.slug, name: organization.name })
  .from(organization)
  .where(or(eq(organization.id, orgRef), eq(organization.slug, orgRef)))
  .limit(1);
const org = orgs[0];
if (!org) throw new Error(`No organization matching id/slug "${orgRef}"`);

const existing = await db
  .select({ plan: orgSettings.plan })
  .from(orgSettings)
  .where(eq(orgSettings.orgId, org.id))
  .limit(1);

const plan = alsoSetPlan ? "enterprise" : existing[0]?.plan;

if (existing.length === 0) {
  await db.insert(orgSettings).values({
    orgId: org.id,
    enterpriseSeatLimit: seats,
    ...(alsoSetPlan ? { plan: "enterprise" as const } : {}),
  });
} else {
  await db
    .update(orgSettings)
    .set({
      enterpriseSeatLimit: seats,
      ...(alsoSetPlan ? { plan: "enterprise" as const } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orgSettings.orgId, org.id));
}

console.log(
  `Set enterprise seat cap for "${org.name}" (${org.slug ?? org.id}) to ${seats ?? "uncapped"}.`,
);
if (plan !== "enterprise") {
  console.warn(
    `Warning: org plan is "${plan ?? "free"}", not "enterprise" — the cap only takes effect on the enterprise plan. Re-run with --plan to set it.`,
  );
}

process.exit(0);
