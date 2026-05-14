# Provider-Agnostic Payments

## Scope

Payment architecture should support Stripe first and multiple providers later.

Included:

- Provider interface.
- Provider registry.
- Payment connections per organization.
- Public checkout after registration.
- Webhook reconciliation.
- Multi-provider selection design.
- Refund and expiry lifecycle.

## Source-of-truth Rule

- Buching owns the catalog. `Event` row is the product.
- Tenants do **not** create products in their merchant dashboard.
- At checkout time, the adapter sends the provider a dynamic ad-hoc line item built from the `Event` row. Verified viable on Stripe (`price_data` + inline `product_data`), Square (`order.line_items` with `base_price_money`, or `quick_pay`), PayPal Orders v2 (`purchase_units[].items[]`).
- Provider-side catalog/POS sync is out of scope for v1.

## Provider Interface

Responsibilities:

- Generate provider connect URL (onboarding link).
- Handle OAuth/onboarding callback.
- Disconnect account.
- Create checkout session from a normalized `CreateCheckoutInput`.
- Refund a payment.
- Verify webhook signature.
- Normalize provider webhook event into `NormalizedPaymentEvent`.

### CreateCheckoutInput

Adapter input is provider-agnostic:

- `tenantId`, `eventId`, `bookingId`, `paymentId`.
- `title`, optional `description`.
- `amount` (integer, minor units), `currency` (ISO 4217).
- `successUrl`, `cancelUrl`.

### Money Representation

- Internal: integer minor units (e.g. cents). Single `Money { amount: number; currency: string }` type.
- Format at adapter boundary:
  - Stripe: integer minor units (no conversion).
  - Square: integer minor units (no conversion).
  - PayPal: string decimal (`"50.00"`). Adapter converts.

## Normalized Events

- `payment.completed`.
- `payment.refunded`.
- `payment.expired`.
- `payment.failed`.

Adapter returns the normalized event plus the original provider event ID for idempotent storage.

## Checkout Flow

1. Public registration is created.
2. Paid event creates registration with `paymentStatus = pending`.
3. If one provider is connected, auto-select it.
4. If multiple providers are connected, visitor chooses provider.
5. Server creates checkout session with dynamic line item from `Event`.
6. Server stores provider, session ID, and idempotency key on registration.
7. Provider webhook updates payment status.

### Idempotency

- Per provider call use a stable idempotency key per **checkout attempt**, not per payment. Customer retry must produce a new attempt or reuse the same key safely.
- Provider header/body field:
  - Stripe: `Idempotency-Key` header.
  - Square: `idempotency_key` body field.
  - PayPal: `PayPal-Request-Id` header.
- Persist a `webhook_events` table keyed on `(provider, providerEventId)` to deduplicate retries and out-of-order delivery.

## Metadata Linking

Pass identifiers in provider metadata so webhooks can resolve back to a booking:

- Stripe: `metadata` (k/v).
- Square: `order.metadata` and `reference_id`.
- PayPal: `referenceId`, `customId`, `invoiceId` (note 127-char limit on `invoiceId`).

Always include `tenantId`, `eventId`, `bookingId`, `paymentId`.

## Webhook Reconciliation

- Webhook endpoint lives on the Buching backend, never on tenant domains.
- Verify signatures server-side per provider (see provider plans).
- Confirm payment on the **money-received** event, not the approval event:
  - Stripe: `checkout.session.completed` (with payment_status check) or `payment_intent.succeeded`.
  - Square: `payment.updated` with status `COMPLETED`.
  - PayPal: `PAYMENT.CAPTURE.COMPLETED` (not `CHECKOUT.ORDER.APPROVED`).
- Never mark booking paid from the success-page redirect; that page is unauthenticated and unreliable.

## Expiry and Refunds

- Expired pending payments move to `expired` and cancel the registration.
- Refund webhooks move payment status to `refunded`.
- Expired/cancelled paid registrations free capacity.
- Background job sweeps `pending_payment` registrations older than the hold TTL (default 15 minutes), expires the provider session where supported, and frees the slot.

## Field Constraints

- Event title used as line item name has a hard cap of 127 chars (PayPal limit). Validate at write time on `Event`.
- Currency must match the connected account's supported currency. Square locations have a fixed currency — validate against `TenantPaymentAccount.currency` before creating checkout.

## API Versions

Pin per adapter and store in adapter config:

- Stripe: `apiVersion` on the SDK client.
- Square: `Square-Version` request header (e.g. `2026-01-22`).
- PayPal: SDK release pinned via package version.

## Provider Targets

V1 ships with three providers behind the same adapter interface:

- Stripe Connect (Standard).
- Square (OAuth + Checkout API / Payment Links).
- PayPal Commerce (Multiparty + Partner Referrals).

Implementation order within v1 is Stripe → Square → PayPal, but all three are required to consider payments feature-complete. No provider is post-v1.

Each adapter must satisfy the same `PaymentProviderAdapter` contract:

- `createOnboardingLink`
- `createCheckout`
- `refundPayment`
- `verifyWebhook`
- `parseWebhook` returning `NormalizedPaymentEvent`
