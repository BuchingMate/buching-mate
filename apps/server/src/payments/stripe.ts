import Stripe from "stripe";
import type { Money } from "@workspace/contracts";
import { requireStripeEnv } from "../env";
import { getLogger } from "../observability/request-context";
import {
  AdapterConfigError,
  InvalidSignatureError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type ExchangedAccount,
  type GetOrCreateCustomerInput,
  type GetOrCreateCustomerResult,
  type NormalizedPaymentEvent,
  type PaymentProviderAdapter,
  type RefundInput,
  type RefundResult,
} from "./adapter";

let cachedClient: Stripe | null = null;

function client(): Stripe {
  if (!cachedClient) {
    const { secretKey } = requireStripeEnv();
    cachedClient = new Stripe(secretKey, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return cachedClient;
}

function expectedLivemode(): boolean {
  const { secretKey } = requireStripeEnv();
  return secretKey.startsWith("sk_live_");
}

function moneyToStripeAmount(money: Money): number {
  return money.amount;
}

function platformFeePercent(): number {
  const raw = process.env.STRIPE_PLATFORM_FEE_PERCENT;
  if (!raw) return 0;
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(pct, 100);
}

function computeApplicationFee(amountMinor: number): number | null {
  const pct = platformFeePercent();
  if (pct === 0 || amountMinor <= 0) return null;
  return Math.round((amountMinor * pct) / 100);
}

export function createStripeAdapter(): PaymentProviderAdapter {
  return {
    provider: "stripe",

    buildOnboardingUrl({ state, redirectUri }) {
      const { clientId } = requireStripeEnv();
      const url = new URL("https://connect.stripe.com/oauth/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("scope", "read_write");
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirectUri);
      return url.toString();
    },

    async exchangeOAuthCode({ code }): Promise<ExchangedAccount> {
      const stripe = client();
      const tokenResponse = await stripe.oauth.token({
        grant_type: "authorization_code",
        code,
      });
      const stripeUserId = tokenResponse.stripe_user_id;
      if (!stripeUserId) {
        throw new AdapterConfigError("stripe oauth response missing stripe_user_id");
      }
      const account = await stripe.accounts.retrieve(stripeUserId);
      const currency = (account.default_currency ?? "usd").toUpperCase();
      return {
        accountId: stripeUserId,
        currency,
        metadata: {
          livemode: tokenResponse.livemode,
          scope: tokenResponse.scope,
          country: account.country,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          email: account.email,
          rawAccount: account,
        },
      };
    },

    async createCheckout(
      connectionAccountId,
      input: CreateCheckoutInput,
    ): Promise<CheckoutSession> {
      const stripe = client();
      const sharedMetadata = {
        registrationId: input.registrationId,
        eventId: input.eventId,
        orgId: input.orgId,
      };
      const amountMinor = moneyToStripeAmount(input.amount);
      const appFee = computeApplicationFee(amountMinor);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.amount.currency.toLowerCase(),
                unit_amount: amountMinor,
                product_data: {
                  name: input.title,
                  ...(input.description ? { description: input.description } : {}),
                },
              },
            },
          ],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          client_reference_id: input.registrationId,
          ...(input.customerId ? { customer: input.customerId } : {}),
          metadata: sharedMetadata,
          payment_intent_data: {
            metadata: sharedMetadata,
            ...(appFee !== null ? { application_fee_amount: appFee } : {}),
          },
        },
        {
          stripeAccount: connectionAccountId,
          idempotencyKey: input.idempotencyKey,
        },
      );
      if (!session.url) {
        throw new AdapterConfigError("stripe checkout session created without url");
      }
      return { sessionId: session.id, url: session.url };
    },

    async getOrCreateCustomer(
      connectionAccountId,
      input: GetOrCreateCustomerInput,
    ): Promise<GetOrCreateCustomerResult> {
      const stripe = client();
      const customer = await stripe.customers.create(
        {
          email: input.email,
          ...(input.name ? { name: input.name } : {}),
          metadata: {
            attendeeId: input.externalId,
            ...(input.metadata ?? {}),
          },
        },
        {
          stripeAccount: connectionAccountId,
          idempotencyKey: `customer:${input.externalId}`,
        },
      );
      return { customerId: customer.id };
    },

    async refundPayment(connectionAccountId, input: RefundInput): Promise<RefundResult> {
      const stripe = client();
      const refund = await stripe.refunds.create(
        {
          payment_intent: input.paymentReference,
          ...(input.amount ? { amount: moneyToStripeAmount(input.amount) } : {}),
          ...(input.reason ? { reason: mapRefundReason(input.reason) } : {}),
        },
        {
          stripeAccount: connectionAccountId,
          idempotencyKey: input.idempotencyKey,
        },
      );
      return {
        refundId: refund.id,
        status: mapRefundStatus(refund.status),
        raw: refund as unknown as Record<string, unknown>,
      };
    },

    async verifyAndParse(headers, rawBody): Promise<NormalizedPaymentEvent | null> {
      const { webhookSecret } = requireStripeEnv();
      const sig = headers["stripe-signature"];
      if (!sig) {
        throw new InvalidSignatureError("missing stripe-signature header");
      }
      const stripe = client();
      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
      } catch (err) {
        throw new InvalidSignatureError(
          err instanceof Error ? err.message : "invalid stripe signature",
        );
      }
      return mapStripeEvent(event);
    },

    async expireCheckout(connectionAccountId, sessionId) {
      const stripe = client();
      await stripe.checkout.sessions.expire(sessionId, undefined, {
        stripeAccount: connectionAccountId,
      });
    },
  };
}

function mapStripeEvent(event: Stripe.Event): NormalizedPaymentEvent | null {
  const expectedLive = expectedLivemode();
  if (event.livemode !== expectedLive) {
    getLogger().warn(
      { eventId: event.id, eventType: event.type, eventLivemode: event.livemode, expectedLive },
      "webhook.livemodeMismatch",
    );
    return null;
  }
  const providerEventId = event.id;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return null;
      const paymentIntentId = paymentIntentFromSession(session);
      const registrationId = registrationIdFromMetadata(session.metadata);
      return {
        type: "payment.completed",
        paymentReference: paymentIntentId ?? session.id,
        providerEventId,
        registrationId,
        paymentIntentId,
      };
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId = paymentIntentFromSession(session);
      const registrationId = registrationIdFromMetadata(session.metadata);
      return {
        type: "payment.expired",
        paymentReference: paymentIntentId ?? session.id,
        providerEventId,
        registrationId,
        paymentIntentId,
      };
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      return {
        type: "payment.failed",
        paymentReference: intent.id,
        providerEventId,
        registrationId: registrationIdFromMetadata(intent.metadata),
        paymentIntentId: intent.id,
        reason: intent.last_payment_error?.message,
      };
    }
    case "charge.refunded":
    case "refund.created":
    case "refund.updated": {
      const refund =
        event.type === "charge.refunded"
          ? extractRefundFromCharge(event.data.object as Stripe.Charge)
          : (event.data.object as Stripe.Refund);
      if (!refund) return null;
      const paymentIntentId =
        typeof refund.payment_intent === "string" ? refund.payment_intent : null;
      if (!paymentIntentId) return null;
      return {
        type: "payment.refunded",
        paymentReference: paymentIntentId,
        providerEventId,
        providerRefundId: refund.id,
        registrationId: registrationIdFromMetadata(refund.metadata),
        paymentIntentId,
        amount: refund.amount
          ? { amount: refund.amount, currency: (refund.currency ?? "usd").toUpperCase() }
          : undefined,
        status: mapRefundStatus(refund.status),
      };
    }
    default:
      return null;
  }
}

function paymentIntentFromSession(session: Stripe.Checkout.Session): string | undefined {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  if (session.payment_intent && "id" in session.payment_intent) return session.payment_intent.id;
  return undefined;
}

function registrationIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): string | undefined {
  const value = metadata?.registrationId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extractRefundFromCharge(charge: Stripe.Charge): Stripe.Refund | null {
  const refunds = charge.refunds;
  if (!refunds || !refunds.data || refunds.data.length === 0) return null;
  return refunds.data[refunds.data.length - 1];
}

function mapRefundStatus(status: string | null | undefined): RefundResult["status"] {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}

function mapRefundReason(reason: string): Stripe.RefundCreateParams.Reason | undefined {
  if (reason === "duplicate" || reason === "fraudulent" || reason === "requested_by_customer") {
    return reason;
  }
  return undefined;
}
