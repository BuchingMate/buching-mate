import { beforeEach, describe, expect, mock, test } from "bun:test";

type AnyFn = (...args: unknown[]) => unknown;

const stripeMock = {
  webhooks: {
    constructEventAsync: mock<AnyFn>(async () => ({})),
  },
  checkout: {
    sessions: {
      create: mock<AnyFn>(async () => ({ id: "cs_test_1", url: "https://stripe/checkout" })),
      expire: mock<AnyFn>(async () => ({})),
    },
  },
  oauth: {
    token: mock<AnyFn>(async () => ({
      stripe_user_id: "acct_1",
      livemode: false,
      scope: "read_write",
    })),
  },
  accounts: {
    retrieve: mock<AnyFn>(async () => ({
      default_currency: "usd",
      country: "US",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      email: "merchant@example.com",
    })),
  },
  customers: {
    create: mock<AnyFn>(async () => ({ id: "cus_1" })),
  },
  refunds: {
    create: mock<AnyFn>(async () => ({ id: "re_1", status: "succeeded" })),
  },
};

mock.module("stripe", () => ({
  default: function FakeStripe() {
    return stripeMock;
  },
}));

const { createStripeAdapter } = await import("./stripe");
const { InvalidSignatureError } = await import("./adapter");

const adapter = createStripeAdapter();

beforeEach(() => {
  stripeMock.webhooks.constructEventAsync.mockClear();
  stripeMock.checkout.sessions.create.mockClear();
  stripeMock.checkout.sessions.expire.mockClear();
  stripeMock.oauth.token.mockClear();
  stripeMock.accounts.retrieve.mockClear();
  stripeMock.customers.create.mockClear();
  stripeMock.refunds.create.mockClear();
});

describe("buildOnboardingUrl", () => {
  test("should build a Stripe Connect OAuth URL with the required query params", () => {
    const url = adapter.buildOnboardingUrl({
      state: "abc",
      redirectUri: "https://app.example.com/cb",
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe("connect.stripe.com");
    expect(parsed.pathname).toBe("/oauth/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("ca_test_dummy");
    expect(parsed.searchParams.get("scope")).toBe("read_write");
    expect(parsed.searchParams.get("state")).toBe("abc");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.example.com/cb");
  });
});

describe("createCheckout", () => {
  test("should pass the correct amount, currency, and idempotency key to Stripe", async () => {
    await adapter.createCheckout("acct_123", {
      orgId: "org_1",
      eventId: "evt_1",
      registrationId: "reg_1",
      title: "Yoga Class",
      description: null,
      amount: { amount: 5000, currency: "USD" },
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
      expiresAt: new Date("2026-06-01T00:00:00Z"),
      idempotencyKey: "idem-1",
    });

    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const [params, opts] = stripeMock.checkout.sessions.create.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    const lineItems = (
      params.line_items as Array<{ price_data: { currency: string; unit_amount: number } }>
    )[0];
    expect(lineItems.price_data.currency).toBe("usd");
    expect(lineItems.price_data.unit_amount).toBe(5000);
    expect(opts.stripeAccount).toBe("acct_123");
    expect(opts.idempotencyKey).toBe("idem-1");
  });

  test("should add a 1% application fee when STRIPE_PLATFORM_FEE_PERCENT is 1", async () => {
    await adapter.createCheckout("acct_123", {
      orgId: "org_1",
      eventId: "evt_1",
      registrationId: "reg_1",
      title: "Class",
      amount: { amount: 10000, currency: "USD" },
      successUrl: "https://app/s",
      cancelUrl: "https://app/c",
      expiresAt: new Date(),
      idempotencyKey: "idem-2",
    });

    const params = stripeMock.checkout.sessions.create.mock.calls[0][0] as {
      payment_intent_data: { application_fee_amount?: number };
    };
    expect(params.payment_intent_data.application_fee_amount).toBe(100); // 1% of 10000
  });

  test("should put the registration id in metadata so webhooks can match it back", async () => {
    await adapter.createCheckout("acct_123", {
      orgId: "org_1",
      eventId: "evt_1",
      registrationId: "reg_xyz",
      title: "Class",
      amount: { amount: 100, currency: "USD" },
      successUrl: "https://app/s",
      cancelUrl: "https://app/c",
      expiresAt: new Date(),
      idempotencyKey: "idem-3",
    });
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0] as {
      metadata: { registrationId: string };
      payment_intent_data: { metadata: { registrationId: string } };
    };
    expect(params.metadata.registrationId).toBe("reg_xyz");
    expect(params.payment_intent_data.metadata.registrationId).toBe("reg_xyz");
  });
});

describe("verifyAndParse", () => {
  test("should throw InvalidSignatureError when the stripe-signature header is missing", async () => {
    await expect(adapter.verifyAndParse({}, "{}")).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  test("should throw InvalidSignatureError when Stripe rejects the signature", async () => {
    stripeMock.webhooks.constructEventAsync.mockImplementationOnce(async () => {
      throw new Error("bad signature");
    });
    await expect(
      adapter.verifyAndParse({ "stripe-signature": "t=1,v1=abc" }, "{}"),
    ).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  test("should normalize checkout.session.completed into a payment.completed event", async () => {
    stripeMock.webhooks.constructEventAsync.mockImplementationOnce(async () => ({
      id: "evt_1",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_1",
          payment_status: "paid",
          payment_intent: "pi_abc",
          metadata: { registrationId: "reg_1" },
        },
      },
    }));
    const result = await adapter.verifyAndParse({ "stripe-signature": "ok" }, "{}");
    expect(result?.type).toBe("payment.completed");
    if (result?.type !== "payment.completed") return;
    expect(result.registrationId).toBe("reg_1");
    expect(result.paymentIntentId).toBe("pi_abc");
    expect(result.providerEventId).toBe("evt_1");
  });

  test("should normalize checkout.session.expired into a payment.expired event", async () => {
    stripeMock.webhooks.constructEventAsync.mockImplementationOnce(async () => ({
      id: "evt_2",
      type: "checkout.session.expired",
      livemode: false,
      data: {
        object: {
          id: "cs_2",
          payment_intent: "pi_xyz",
          metadata: { registrationId: "reg_2" },
        },
      },
    }));
    const result = await adapter.verifyAndParse({ "stripe-signature": "ok" }, "{}");
    expect(result?.type).toBe("payment.expired");
  });

  test("should normalize payment_intent.payment_failed into a payment.failed event", async () => {
    stripeMock.webhooks.constructEventAsync.mockImplementationOnce(async () => ({
      id: "evt_3",
      type: "payment_intent.payment_failed",
      livemode: false,
      data: {
        object: {
          id: "pi_fail",
          metadata: { registrationId: "reg_3" },
          last_payment_error: { message: "card_declined" },
        },
      },
    }));
    const result = await adapter.verifyAndParse({ "stripe-signature": "ok" }, "{}");
    expect(result?.type).toBe("payment.failed");
    if (result?.type !== "payment.failed") return;
    expect(result.reason).toBe("card_declined");
  });

  test("should ignore live-mode events when the API key is a test key", async () => {
    stripeMock.webhooks.constructEventAsync.mockImplementationOnce(async () => ({
      id: "evt_live",
      type: "checkout.session.completed",
      livemode: true,
      data: { object: { id: "cs", payment_status: "paid", payment_intent: "pi", metadata: {} } },
    }));
    const result = await adapter.verifyAndParse({ "stripe-signature": "ok" }, "{}");
    expect(result).toBeNull();
  });

  test("should ignore checkout.session.completed when payment_status is not paid", async () => {
    stripeMock.webhooks.constructEventAsync.mockImplementationOnce(async () => ({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: { id: "cs", payment_status: "unpaid", payment_intent: "pi", metadata: {} },
      },
    }));
    const result = await adapter.verifyAndParse({ "stripe-signature": "ok" }, "{}");
    expect(result).toBeNull();
  });

  test("should ignore event types that the adapter does not handle", async () => {
    stripeMock.webhooks.constructEventAsync.mockImplementationOnce(async () => ({
      id: "evt_other",
      type: "invoice.created",
      livemode: false,
      data: { object: {} },
    }));
    const result = await adapter.verifyAndParse({ "stripe-signature": "ok" }, "{}");
    expect(result).toBeNull();
  });
});
