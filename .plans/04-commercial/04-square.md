# Square

## Scope

Square is a v1 payment provider alongside Stripe Connect and PayPal.

Tenants connect their own Square seller account via OAuth. Buching creates Square Payment Links with ad-hoc line items at checkout time. Tenants do **not** create Square Catalog items.

## Square Concepts To Track Per Tenant

`TenantPaymentAccount` for Square stores:

- `squareMerchantId`.
- `squareLocationId` (required on every checkout call; tenant may have multiple locations — let admin pick during connect).
- `squareAccessTokenEncrypted`.
- `squareRefreshTokenEncrypted`.
- `squareTokenExpiresAt`.
- `currency` (derived from selected location; locations have a fixed currency).

## Environment

- `SQUARE_APPLICATION_ID`.
- `SQUARE_APPLICATION_SECRET`.
- `SQUARE_WEBHOOK_SIGNATURE_KEY`.
- `SQUARE_API_VERSION` pinned in adapter config (e.g. `2026-01-22`) and sent as `Square-Version` header on every request.
- `SQUARE_ENVIRONMENT` (`sandbox` | `production`).

## Connect Flow

1. Admin starts connect from settings.
2. Server generates OAuth state with org ID and provider.
3. Redirect to Square OAuth authorize URL with required scopes:
   - `MERCHANT_PROFILE_READ`
   - `PAYMENTS_WRITE`
   - `PAYMENTS_READ`
   - `ORDERS_WRITE`
   - `ORDERS_READ`
4. Square redirects back with code; server verifies state and exchanges code for access + refresh tokens.
5. Server fetches merchant locations via `ListLocations` and stores merchant + chosen `locationId`.
6. Persist tokens encrypted; schedule refresh before `expires_at`.

## Checkout Flow

- Endpoint: `POST /v2/online-checkout/payment-links`.
- Build `order.line_items[0]` inline from the `Event`:
  - `name` = event title (≤127 chars to stay under shared cap).
  - `quantity` = `"1"`.
  - `base_price_money.amount` = event price in minor units.
  - `base_price_money.currency` = location currency (validate match).
- Set `order.location_id` from the tenant account.
- Set `order.metadata`: `tenantId`, `eventId`, `bookingId`, `paymentId`, `registrationId`.
- Set `order.reference_id` = `bookingId` for cross-reporting.
- Body `idempotency_key` per checkout attempt.
- `checkout_options.redirect_url` = `successUrl`.
- Use `quick_pay` form only if a single ad-hoc item with no metadata fields beyond name+price is sufficient — prefer the full `order` form for booking flows so we keep metadata.

## Platform Fees

- Set `app_fee_money` on the underlying payment to capture Buching's platform fee.
- Tenant must have onboarded via the Square partner program for the app to collect fees.
- Fee percentage stored on the org's plan.

## Webhooks

- Single Buching endpoint: `POST /webhooks/square`.
- Verify `x-square-hmacsha256-signature` header using `SQUARE_WEBHOOK_SIGNATURE_KEY` and the request URL + body.
- Persist `(provider, providerEventId)` for idempotent processing.
- Handle (with mapping to normalized events):
  - `payment.updated` with `status === COMPLETED` → `payment.completed`.
  - `payment.updated` with `status === FAILED` → `payment.failed`.
  - `refund.updated` with `status === COMPLETED` → `payment.refunded`.
  - `order.updated` reaching `CANCELED` for a payment-link order past TTL → `payment.expired`.

Square does not emit a single "checkout expired" event — pair the webhook handler with the TTL sweep job that explicitly cancels stale orders.

## Refunds

- `RefundPayment` with `payment_id`, `amount_money`, `idempotency_key`, optional `reason`.
- Adapter exposes full and partial refunds.

## Token Lifecycle

- Access tokens are short-lived. Refresh proactively using the refresh token.
- Persist new access + refresh tokens on every refresh; old refresh token rotates.
- On `OAUTHORIZATION.REVOKED` webhook (or refresh failure), mark `TenantPaymentAccount.status = disabled` and surface reconnect prompt in settings.

## Security

- Verify Square signatures server-side; reject on mismatch.
- Encrypt access + refresh tokens at rest.
- Use OAuth state to prevent CSRF.
- Never confirm bookings from the redirect URL; webhook is the only source of truth.
- Validate `locationId` on every checkout — never trust client-provided location.
