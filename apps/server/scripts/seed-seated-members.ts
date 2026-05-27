// Seed N admin members into an org to fill its seat cap, then test whether the
// next admin would be blocked. Raw DB inserts bypass the beforeAddMember hook, so
// this only fills seats; the cap guard (assertSeatAvailableForRole) is then called
// directly to show pass/throw. See .plans/04-commercial/06-seat-billing.md.
//
// Run: cd apps/server && bun --env-file=../../.env scripts/seed-seated-members.ts <orgSlugOrId> <count>
// Cleanup: pass --clean to remove members/users this script created (email prefix seed-admin-).

import { and, eq, like, or } from "drizzle-orm";
import { db } from "../src/db";
import { member, organization, user } from "../src/db/auth-schema";
import {
  assertSeatAvailableForRole,
  countSeatedMembers,
  seatCapFor,
} from "../src/ee/billing/polar";

const SEED_PREFIX = "seed-admin-";

const [orgRef, countArg, ...flags] = process.argv.slice(2);
if (!orgRef) {
  throw new Error("Usage: seed-seated-members.ts <orgSlugOrId> <count> [--clean]");
}
const clean = flags.includes("--clean");

const orgs = await db
  .select({ id: organization.id, slug: organization.slug, name: organization.name })
  .from(organization)
  .where(or(eq(organization.id, orgRef), eq(organization.slug, orgRef)))
  .limit(1);
const org = orgs[0];
if (!org) throw new Error(`No organization matching id/slug "${orgRef}"`);
const label = `${org.name} (${org.slug ?? org.id})`;

if (clean) {
  const seeded = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, `${SEED_PREFIX}%@seed.local`));
  for (const u of seeded) {
    await db.delete(member).where(and(eq(member.organizationId, org.id), eq(member.userId, u.id)));
    await db.delete(user).where(eq(user.id, u.id));
  }
  console.log(`Removed ${seeded.length} seeded user(s) and their membership in ${label}.`);
  await report(org.id, label);
  process.exit(0);
}

const count = Number(countArg);
if (!Number.isInteger(count) || count < 1) {
  throw new Error(`Invalid count "${countArg}": expected a positive integer`);
}

const now = new Date();
for (let i = 0; i < count; i++) {
  const id = crypto.randomUUID();
  const email = `${SEED_PREFIX}${id.slice(0, 8)}@seed.local`;
  await db.insert(user).values({
    id,
    name: `Seed Admin ${i + 1}`,
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    userId: id,
    role: "admin",
    createdAt: now,
  });
}
console.log(`Inserted ${count} admin member(s) into ${label}.`);

await report(org.id, label);
process.exit(0);

async function report(orgId: string, label: string) {
  const used = await countSeatedMembers(orgId);
  const cap = await seatCapFor(orgId);
  console.log(`Seated (owner+admin): ${used} / cap ${cap} for ${label}.`);
  try {
    await assertSeatAvailableForRole(orgId, "admin");
    console.log("Guard: ANOTHER admin WOULD be allowed (seat available).");
  } catch (err) {
    console.log(`Guard: another admin BLOCKED — ${(err as Error).message}`);
  }
}
