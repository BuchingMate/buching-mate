import { eq } from "drizzle-orm";
import type { PaymentProvider } from "@workspace/contracts";
import { db } from "../../db";
import { paymentConnections, stripePaymentAccounts } from "../../db/schema";
import type { ExchangedAccount } from "../../payments/adapter";

export async function upsertConnection(input: {
  orgId: string;
  provider: PaymentProvider;
  exchanged: ExchangedAccount;
}): Promise<{ connectionId: string }> {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(paymentConnections)
      .where(eq(paymentConnections.orgId, input.orgId))
      .limit(50);

    const previous = existing.find((row) => row.provider === input.provider);
    let connectionId: string;

    if (previous) {
      await tx
        .update(paymentConnections)
        .set({
          accountId: input.exchanged.accountId,
          currency: input.exchanged.currency,
          status: "active",
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentConnections.id, previous.id));
      connectionId = previous.id;
    } else {
      const [row] = await tx
        .insert(paymentConnections)
        .values({
          orgId: input.orgId,
          provider: input.provider,
          accountId: input.exchanged.accountId,
          currency: input.exchanged.currency,
          status: "active",
          lastSyncedAt: new Date(),
        })
        .returning({ id: paymentConnections.id });
      connectionId = row.id;
    }

    if (input.provider === "stripe") {
      await upsertStripeDetail(tx, connectionId, input.exchanged);
    }
    // square + paypal detail upserts land when those adapters ship.

    return { connectionId };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function upsertStripeDetail(tx: Tx, connectionId: string, exchanged: ExchangedAccount) {
  const meta = exchanged.metadata;
  const livemode = Boolean(meta.livemode);
  const scope = typeof meta.scope === "string" ? meta.scope : null;
  const country = typeof meta.country === "string" ? meta.country : null;
  const email = typeof meta.email === "string" ? meta.email : null;
  const chargesEnabled = Boolean(meta.chargesEnabled);
  const payoutsEnabled = Boolean(meta.payoutsEnabled);
  const detailsSubmitted = Boolean(meta.detailsSubmitted);
  const rawAccount =
    meta.rawAccount && typeof meta.rawAccount === "object"
      ? (meta.rawAccount as Record<string, unknown>)
      : null;

  const existing = await tx
    .select()
    .from(stripePaymentAccounts)
    .where(eq(stripePaymentAccounts.connectionId, connectionId))
    .limit(1);

  if (existing[0]) {
    await tx
      .update(stripePaymentAccounts)
      .set({
        stripeUserId: exchanged.accountId,
        livemode,
        scope,
        defaultCurrency: exchanged.currency,
        country,
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
        email,
        rawAccount,
        updatedAt: new Date(),
      })
      .where(eq(stripePaymentAccounts.connectionId, connectionId));
    return;
  }

  await tx.insert(stripePaymentAccounts).values({
    connectionId,
    stripeUserId: exchanged.accountId,
    livemode,
    scope,
    defaultCurrency: exchanged.currency,
    country,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    email,
    rawAccount,
  });
}
