# Reference Projects

## `../bookingms`

Use as the lean implementation reference.

Relevant patterns:

- Better Auth organization tables extended with `ownerId`, plan fields, Polar IDs, and active organization session data.
- Domain tables for org settings, events, attendees, registrations, and resources.
- Event lifecycle fields: status, visibility, recurrence, capacity, price.
- Public booking route at `book.$slug.tsx`.
- Dashboard routes for events, calendar, billing, attendees, and settings.
- Server functions for events, public orgs/events, registrations, attendees, and organizations.

Avoid copying directly:

- TanStack Start server function architecture, because Buching already uses separate Hono server and Vite web app.
- Any dependency choices that conflict with current workspace conventions.

## `../bookings-made-easy`

Use as the broad product reference.

Relevant patterns:

- Hono route grouping: orgs, events, attendees, registrations, public, payments, billing, webhooks.
- Full schema for organizations, members, settings, invites, events, attendees, registrations, payment connections, webhook deliveries, Polar customers.
- Event UI: table filters, kanban, detail dialog, event form, payment indicators.
- Public booking UI: org branding, search/filter, capacity display, registration dialog, payment checkout.
- Settings UI: organization, team, integrations, webhook logs, categories, email templates.
- Calendar UI: month/day/week views, drag/drop rescheduling, duration resize, heatmap.
- Resource UI: instructors, materials, locations.

Adaptations for Buching:

- Use single-org-per-user initially, not multi-org switcher.
- Plan limits only; do not implement Polar subscription checkout now.
- Keep i18n out of the current plan.
- Implement payments with provider abstraction and Stripe Connect, but keep SaaS platform billing separate and deferred.
