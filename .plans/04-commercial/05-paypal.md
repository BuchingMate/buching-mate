# PayPal

## Scope

PayPal is a v1 payment provider alongside Stripe Connect and Square.

Tenants connect their own PayPal merchant account via PayPal's Partner Referrals (Multiparty) flow. Buching creates PayPal Orders with dynamic line items at checkout time. Tenants do **not** create PayPal catalog products.

## PayPal Concepts To Track Per Tenant

`TenantPaymentAccount` for PayPal stores:

- `paypalMerchantId` (the seller's PayPal payer ID).
- `paypalTrackingId` (the partner referral tracking ID used during onboarding).
- `paypalOnboardingStatus` (`pending`, `active`, `restricted`, `disabled`).
- `paypalPermissionsGranted` (granted permissions list returned post-onboarding).
- `paypalPaymentsReceivable` (boolean; from seller status check).
- `paypalPrimaryEmailConfirmed` (boolean; from seller status check).
- `currency` (selected during connect from supported set).

## Environment

- `PAYPAL_CLIENT_ID`.
- `PAYPAL_CLIENT_SECRET`.
- `PAYPAL_PARTNER_ID` (BN code / partner attribution ID).
- `PAYPAL_WEBHOOK_ID`.
- `PAYPAL_ENVIRONMENT` (`sandbox` | `live`).

## Connect Flow (Partner Referrals)

1. Admin starts connect from settings.
2. Server calls Partner Referrals API to generate an onboarding link with our partner ID, tracking ID, and return URL.
3. Admin completes PayPal onboarding in a popup or full-page redirect.
4. PayPal redirects back with the merchant's payer ID.
5. Server polls `/v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}` to confirm:
   - `payments_receivable === true`
   - `primary_email_confirmed === true`
   - granted permissions include the ones we requested
6. Persist account; mark `status = active` only when all checks pass. Otherwise `pending` and surface what the seller still needs to complete.

## Checkout Flow

- Endpoint: `POST /v2/checkout/orders`.
- Body:
  - `intent`: `CAPTURE`.
  - `purchase_units[0]`:
    - `reference_id` = `paymentId`.
    - `custom_id` = `bookingId` (≤255 chars).
    - `invoice_id` = `registrationId` (≤127 chars; must be unique per merchant).
    - `description` = optional event description (≤127 chars).
    - `payee.merchant_id` = tenant's PayPal merchant ID (multiparty routing).
    - `items[0]`:
      - `name` = event title (≤127 chars).
      - `quantity` = `"1"`.
      - `unit_amount`: `{ currency_code, value }` where `value` is decimal string (e.g. `"50.00"`).
    - `amount`:
      - `currency_code` = org currency.
      - `value` = decimal string sum of items.
      - `breakdown.item_total` matches `value`.
    - `payment_instruction.platform_fees[0].amount` = optional platform fee in same currency.
- Headers:
  - `PayPal-Request-Id` = idempotency key per checkout attempt.
  - `PayPal-Partner-Attribution-Id` = `PAYPAL_PARTNER_ID`.
  - `PayPal-Auth-Assertion` = JWT identifying the merchant for whom the order is created (required for multiparty orders on behalf of seller).
- Response includes an `approve` link; redirect customer there as the checkout URL.

### Money Format

PayPal expects decimal strings, not minor units. Adapter converts at the boundary:

- Internal `Money.amount` stays as integer minor units.
- Adapter formats `amount.value` and `unit_amount.value` as decimal strings using the currency's decimal places (most are 2; JPY/HUF/TWD have 0).

## Platform Fees

- Use `purchase_units[].payment_instruction.platform_fees` to collect Buching's cut.
- Requires the seller's onboarding to grant the partner-fee capability.
- Fee percentage stored on the org's plan.

## Webhooks

- Single Buching endpoint: `POST /webhooks/paypal`.
- Verify webhook signature by calling PayPal's `/v1/notifications/verify-webhook-signature` with the request headers, body, and `PAYPAL_WEBHOOK_ID`. Reject on `SUCCESS` ≠ `verification_status`.
- Persist `(provider, providerEventId)` for idempotent processing.
- Handle (with mapping to normalized events):
  - `CHECKOUT.ORDER.APPROVED` → log only; **do not** mark booking paid.
  - `PAYMENT.CAPTURE.COMPLETED` → `payment.completed` (this is the money-received event).
  - `PAYMENT.CAPTURE.DENIED` / `PAYMENT.CAPTURE.DECLINED` → `payment.failed`.
  - `PAYMENT.CAPTURE.REFUNDED` → `payment.refunded`.
  - `MERCHANT.ONBOARDING.COMPLETED` / `MERCHANT.PARTNER-CONSENT.REVOKED` → update tenant `paypalOnboardingStatus`.

PayPal does not emit a "checkout expired" event for unapproved orders — orders auto-expire after ~3 hours. The TTL sweep job marks stale `pending_payment` registrations as expired regardless.

## Refunds

- `POST /v2/payments/captures/{capture_id}/refund` with optional `amount` for partial refunds and `invoice_id` for cross-reference.
- Header `PayPal-Auth-Assertion` required for multiparty refunds.

## Security

- Verify webhook signatures via PayPal's verification endpoint, not by hand.
- Store no secrets per tenant — multiparty avoids per-seller credentials. Only the merchant ID is stored.
- Use OAuth-style state for the onboarding return URL to prevent CSRF.
- Never confirm bookings from the `approve` redirect; webhook on capture is the only source of truth.
- Validate `payee.merchant_id` matches the connected tenant before creating each order.
