# Webhook Delivery

## Scope

Organizations can configure webhook endpoints and inspect delivery logs.

Included:

- Webhook URL.
- Signing secret.
- Delivery logs.
- Manual retry.
- Event types for registrations and payments.

Queue technology is a technical decision. Start simple if volume is low; introduce Redis/BullMQ when delivery reliability requires background workers.

## Events

Initial event types:

- `registration.created`.
- `registration.cancelled`.
- `registration.waitlisted`.
- `registration.payment.completed`.
- `registration.payment.refunded`.
- `registration.payment.expired`.

Later event types:

- `event.created`.
- `event.updated`.
- `event.cancelled`.

## Payload Shape

```json
{
  "id": "whd_...",
  "timestamp": "2026-05-02T00:00:00.000Z",
  "event": "registration.created",
  "orgId": "...",
  "data": {}
}
```

## Signature

Include headers:

- `X-Booking-Mate-Signature`.
- `X-Booking-Mate-Delivery-Id`.
- `X-Booking-Mate-Event`.

Signature is HMAC-SHA256 over the raw JSON payload using org webhook secret.

## Delivery Logs

Store:

- Status.
- Attempts.
- Last error.
- Response status.
- Duration.
- Payload.
- Delivered timestamp.

## Plan Limits

Webhook configuration is Pro-only under manual plan limits.
