// One-off: create the Luma-style weekly-send capacity add-on products in Polar,
// one flat monthly recurring product per tier (bought on top of the Team plan).
// Tiers, prices, and slugs all come from BROADCAST_TIERS in @workspace/contracts
// so they stay in sync with the app.
//
// Run: cd apps/server && bun --env-file=../../.env scripts/polar-tiers-setup.ts
// Idempotent: skips a product whose name already exists. After running it prints
// the POLAR_BROADCAST_TIERS env value (a { productId: slug } map) to paste into
// your .env so the server can map subscriptions to caps.
//
// Needs a POLAR_ACCESS_TOKEN with products:write. The runtime billing token is
// usually read-only, so use a dedicated token here.

import { Polar } from "@polar-sh/sdk";
import { BROADCAST_TIERS } from "@workspace/contracts";

const token = process.env.POLAR_ACCESS_TOKEN;
if (!token) throw new Error("POLAR_ACCESS_TOKEN missing");
const server = (process.env.POLAR_ENVIRONMENT as "sandbox" | "production") ?? "sandbox";
const polar = new Polar({ accessToken: token, server });

const fmt = (n: number) => n.toLocaleString("en-US");
const productName = (weeklyCap: number) => `Broadcasts — ${fmt(weeklyCap)}/week (Monthly)`;

// The access token may lack organizations:read, so resolve the org id from the
// existing Team product rather than listing organizations.
async function getOrgId(): Promise<string> {
  const teamProductId = process.env.POLAR_PRODUCT_TEAM;
  if (!teamProductId) throw new Error("POLAR_PRODUCT_TEAM missing; needed to resolve org id");
  const product = await polar.products.get({ id: teamProductId });
  return product.organizationId;
}

// name -> productId for products already in the org.
async function existingByName(organizationId: string): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const res = await polar.products.list({ organizationId });
  for await (const page of res) for (const p of page.result.items) byName.set(p.name, p.id);
  return byName;
}

async function main() {
  const organizationId = await getOrgId();
  console.log(`org=${organizationId} env=${server}`);
  const have = await existingByName(organizationId);

  const tierEnv: Record<string, string> = {};
  for (const tier of BROADCAST_TIERS) {
    const name = productName(tier.weeklyCap);
    const existingId = have.get(name);
    if (existingId) {
      console.log(`skip  ${existingId}  ${name} (exists)`);
      tierEnv[existingId] = tier.slug;
      continue;
    }
    const product = await polar.products.create({
      name,
      organizationId,
      recurringInterval: "month",
      prices: [{ amountType: "fixed", priceCurrency: "usd", priceAmount: tier.monthlyPriceCents }],
    });
    console.log(
      `made  ${product.id}  ${name}  $${(tier.monthlyPriceCents / 100).toFixed(2)}/month`,
    );
    tierEnv[product.id] = tier.slug;
  }

  console.log("\nAdd this to your .env:\n");
  console.log(`POLAR_BROADCAST_TIERS=${JSON.stringify(tierEnv)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
