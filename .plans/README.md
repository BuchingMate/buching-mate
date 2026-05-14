# Buching Plans

## Product Direction

Buching is a hybrid event booking SaaS. Events are the primary user-facing object, but resources are first-class because instructors, materials, rooms, and future availability objects all behave like bookable or assignable resources.

Appointment scheduling is not the initial product target. The architecture should leave room for later appointment-style bookings without optimizing the MVP around Calendly-like flows.

## Reference Projects

- `../bookingms`: closest implementation reference for Better Auth organizations, event schema, server functions, public booking, and dashboard routes.
- `../bookings-made-easy`: broader product reference for feature scope, Hono route shape, payments, webhooks, resource management, calendar UX, and docs.

## Implementation Order

Build in user-value order, not file/folder order. Core platform work should be introduced only when it unlocks the next product step.

1. Foundation: current state, reference mapping, target architecture.
2. Organization activation: signup/login, create or join one organization, resolve active org, protect dashboard until org exists.
3. Event creation and viewing: schema/contracts/API needed for events, app shell, event list, create/edit/detail, publish state.
4. Resource assignment: resource CRUD and assigning instructors, locations, materials, and equipment to events.
5. Attendees and registrations: attendee records, registration CRUD, capacity and waitlist behavior.
6. Public booking: public org/event pages, public registration, SEO metadata.
7. Team and settings: invites, member roles, org settings, categories, branding, email templates.
8. Commercial and integrations: plan limits, payments, checkout, webhooks, subdomains/custom domains.
9. Calendar, dashboard, and delivery hardening: calendar views, metrics, quality gates, migration notes.

## Plan Index

- [Current State](00-foundation/01-current-state.md)
- [Reference Projects](00-foundation/02-reference-projects.md)
- [Target Architecture](00-foundation/03-target-architecture.md)
- [Milestones](07-delivery/01-milestones.md)
- [Domain Schema](01-core-platform/01-domain-schema.md)
- [Server API](01-core-platform/02-server-api.md)
- [Shared Contracts](01-core-platform/03-shared-contracts.md)
- [Organization Model](03-organizations-auth/01-org-model.md)
- [RBAC](03-organizations-auth/02-rbac.md)
- [Onboarding and Invites](03-organizations-auth/03-onboarding-invites.md)
- [Events](02-product-features/01-events.md)
- [Resources](02-product-features/06-resources.md)
- [Attendees and Registrations](02-product-features/02-attendees-registrations.md)
- [Public Booking Pages](02-product-features/03-public-booking-pages.md)
- [Customer Accounts](02-product-features/07-customer-accounts.md)
- [Calendar](02-product-features/04-calendar.md)
- [Dashboard](02-product-features/05-dashboard.md)
- [Plan Limits](04-commercial/01-plan-limits.md)
- [Provider-Agnostic Payments](04-commercial/02-provider-agnostic-payments.md)
- [Stripe Connect](04-commercial/03-stripe-connect.md)
- [Square](04-commercial/04-square.md)
- [PayPal](04-commercial/05-paypal.md)
- [Webhook Delivery](05-integrations/01-webhook-delivery.md)
- [Email Templates](05-integrations/02-email-templates.md)
- [Subdomain and Custom Domains](05-integrations/03-subdomain-custom-domains.md)
- [App Shell and Navigation](06-ui/01-app-shell-navigation.md)
- [Settings](06-ui/02-settings.md)
- [Design System](06-ui/03-design-system.md)
- [Testing and Quality](07-delivery/02-testing-quality.md)
- [Migration Notes](07-delivery/03-migration-notes.md)
