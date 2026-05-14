# Target Architecture

## High-Level Shape

Buching remains a monorepo with separate web and server apps.

- Web owns routes, UI state, forms, and data fetching.
- Server owns auth, org authorization, validation, domain APIs, payment/webhook integrations, and database writes.
- Contracts package owns shared request/response types and domain enums used by both apps.

## Product Model

Core objects:

- Organization: tenant boundary, currently one per user account.
- Member: user role inside the organization.
- Resource: generalized assignable/bookable object.
- Event: public or internal scheduled offering.
- Attendee: person registering for events.
- Registration: attendee-to-event link with status and payment state.
- Payment connection: org-owned provider account.
- Webhook delivery: outbound integration audit and retry record.

## Tenant Model

Start with single org per user in product UX, but keep tables and APIs org-scoped so future multi-org support does not require a rewrite.

Every domain row must include `orgId` unless it is globally safe or auth-owned.

## API Model

Use explicit Hono routes, not direct client database access.

- Auth: `/api/auth/*` via Better Auth.
- Authenticated org-scoped APIs: `/api/org/*`, `/api/events`, `/api/resources`, `/api/attendees`, `/api/registrations`, `/api/payments`, `/api/webhooks`.
- Public APIs: `/api/public/orgs/:slug`, `/api/public/orgs/:slug/events`, `/api/public/orgs/:slug/events/:eventId/register`.

## Deferred Architecture

- Appointment scheduling can be added as resource availability plus booking slots later.
- Polar/SaaS billing can be added after manual plan limits prove useful.
- Redis-backed queues can be introduced when webhook/payment job volume or reliability requires it.
