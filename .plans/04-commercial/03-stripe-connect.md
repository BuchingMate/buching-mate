# Stripe Connect

## Scope

Stripe Connect is the first payment provider.

Organizations connect their own Stripe accounts. Buching creates checkout sessions on behalf of connected accounts for paid event registrations.

Tenants do **not** create Stripe Products or Prices. Each checkout session uses inline `price_data` + `product_data` built from the `Event` row at checkout time.

## Connect Flavor

- Use **Stripe Connect Standard** for v1.
- Reasoning: tenant owns merchant of record, manages their own dashboard, handles their own disputes/payouts/tax. Lowest compliance burden on Buching.
- Revisit Express/Custom only if onboarding UX or platform-controlled payouts become a requirement.

## Environment

- `STRIPE_SECRET_KEY`.
- `STRIPE_CLIENT_ID`.
- `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_API_VERSION` pinned in adapter config (e.g. `2025-03-31.basil`).

## Connect Flow

1. Admin starts connect from settings.
2. Server creates OAuth state containing org ID and provider.
3. User completes Stripe OAuth.
4. Server verifies state and exchanges code.
5. Server stores `payment_connections` row with provider `stripe` and connected account ID.
6. User returns to settings.

## Checkout Flow

- Create Stripe Checkout Session with `stripeAccount` header set to the connected account ID (direct charge model).
- Build `line_items[0].price_data` inline from the `Event`:
  - `currency` = org currency.
  - `product_data.name` = event title (≤127 chars).
  - `product_data.description` = optional event description.
  - `unit_amount` = event price in minor units.
  - `quantity` = 1.
- Set `metadata`: `tenantId`, `eventId`, `bookingId`, `paymentId`, `registrationId`.
- Pass `Idempotency-Key` header per checkout attempt.
- Set `expires_at` to enforce the booking hold TTL.
- Return checkout URL.

## Platform Fees

- Optional `application_fee_amount` on the Checkout Session captures Buching's platform fee from the connected account's payment.
- Fee percentage stored on the org's plan, not hardcoded in the adapter.

## Webhooks

- Endpoint lives on Buching backend; verify `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET`.
- Persist `(provider, providerEventId)` for idempotent processing.
- Handle (with mapping to normalized events):
  - `checkout.session.completed` (when `payment_status === 'paid'`) -> `payment.completed`.
  - `checkout.session.expired` -> `payment.expired`.
  - `charge.refunded` / `refund.created` -> `payment.refunded`.
  - `payment_intent.payment_failed` -> `payment.failed`.

## Security

- Verify Stripe signatures server-side.
- Never expose secret keys to the client.
- Use OAuth state to prevent CSRF.
- Treat connected account IDs as identifiers, not secrets.
- Never confirm bookings from the success-page redirect; webhook is the only source of truth.
