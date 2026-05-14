import type { PaymentProvider, Money } from "@workspace/contracts";

export type CreateCheckoutInput = {
  orgId: string;
  eventId: string;
  registrationId: string;
  title: string;
  description?: string | null;
  amount: Money;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  idempotencyKey: string;
  customerId?: string;
};

export type GetOrCreateCustomerInput = {
  externalId: string;
  email: string;
  name?: string | null;
  metadata?: Record<string, string>;
};

export type GetOrCreateCustomerResult = {
  customerId: string;
};

export type CheckoutSession = {
  sessionId: string;
  url: string;
};

export type NormalizedPaymentEvent =
  | {
      type: "payment.completed";
      paymentReference: string;
      providerEventId: string;
      registrationId?: string;
      paymentIntentId?: string;
    }
  | {
      type: "payment.failed";
      paymentReference: string;
      providerEventId: string;
      registrationId?: string;
      paymentIntentId?: string;
      reason?: string;
    }
  | {
      type: "payment.refunded";
      paymentReference: string;
      providerEventId: string;
      providerRefundId: string;
      registrationId?: string;
      paymentIntentId?: string;
      amount?: Money;
      status: "pending" | "succeeded" | "failed" | "canceled";
    }
  | {
      type: "payment.expired";
      paymentReference: string;
      providerEventId: string;
      registrationId?: string;
      paymentIntentId?: string;
    };

export type ExchangedAccount = {
  accountId: string;
  currency: string;
  metadata: Record<string, unknown>;
};

export type RefundInput = {
  paymentReference: string;
  amount?: Money;
  reason?: string;
  idempotencyKey: string;
};

export type RefundResult = {
  refundId: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  raw: Record<string, unknown>;
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  buildOnboardingUrl(input: { state: string; redirectUri: string }): string;
  exchangeOAuthCode(input: { code: string; redirectUri: string }): Promise<ExchangedAccount>;
  createCheckout(connectionAccountId: string, input: CreateCheckoutInput): Promise<CheckoutSession>;
  getOrCreateCustomer(
    connectionAccountId: string,
    input: GetOrCreateCustomerInput,
  ): Promise<GetOrCreateCustomerResult>;
  refundPayment(connectionAccountId: string, input: RefundInput): Promise<RefundResult>;
  verifyAndParse(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): Promise<NormalizedPaymentEvent | null>;
  expireCheckout?(connectionAccountId: string, sessionId: string): Promise<void>;
}

export class InvalidSignatureError extends Error {
  constructor(message = "invalid webhook signature") {
    super(message);
    this.name = "InvalidSignatureError";
  }
}

export class AdapterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterConfigError";
  }
}
