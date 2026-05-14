# Milestones

These milestones are ordered by the product path a user must take, not by technical subsystem. Schema, contracts, middleware, and route work should be pulled into the milestone where it first unlocks user value.

## Milestone 1: Organization Activation

- Signup and login work end-to-end.
- A new user creates or joins exactly one organization before entering the dashboard.
- Active organization is resolved server-side through membership.
- Dashboard routes are protected until an organization exists.
- Minimal organization settings exist: name, slug, contact email, currency.
- Core auth/org middleware exists: `requireAuth`, `requireOrg`, `requireRole`.
- RBAC roles exist: owner, admin, manager, viewer.

Exit criteria:

- A user can sign up, create an organization, reload the app, and still land in the org-scoped app.
- Server APIs reject unauthenticated and cross-org access.

## Milestone 2: Event Creation and Viewing

- Add only the domain schema/contracts needed for organizations and events.
- Event CRUD.
- Event list and event detail.
- Event duplicate.
- Event status and visibility controls.
- Event table filters for search, category, status, visibility.
- App shell/navigation for the authenticated org app.

Exit criteria:

- A manager can create an event and see it in the event list.
- A viewer can read events but cannot mutate them.
- Published/unpublished state is persisted.

## Milestone 3: Resources and Event Assignments

- Resource CRUD.
- Resource type filters and search.
- Assign resources to events.
- Event detail shows assigned resources.
- Validate assigned resources belong to the same organization.

Exit criteria:

- A manager can create an instructor/location/material and assign it to an event.
- Event resource assignments survive reload and reject cross-org IDs.

## Milestone 4: Attendees and Registrations

- Attendee CRUD.
- Registration CRUD.
- Duplicate active registration prevention.
- Capacity and waitlist.
- Event detail shows registrations.

Exit criteria:

- A manager can register an attendee for an event.
- Full events waitlist new registrations.

## Milestone 5: Public Booking

- Public slug org page.
- Public event list/detail for published upcoming events.
- Public registration.
- Public booking success/error states.
- SEO metadata.

Exit criteria:

- A public visitor can view a published event and register without an account.

## Milestone 6: Team and Settings

- Team invites through Better Auth organization invite flow.
- Member role updates and removal.
- Organization categories.
- Branding.
- Email templates.
- Plan limit UI placeholders.

Exit criteria:

- An admin can invite a teammate and assign their role.
- Organization settings affect event forms and public pages.

## Milestone 7: Payments

- Provider interface and registry.
- Stripe Connect.
- Public checkout.
- Payment webhooks.
- Payment status indicators.
- Expiry/refund handling.

Exit criteria:

- A paid event can collect payment and update registration payment status from webhook events.

## Milestone 8: Webhooks and Domains

- Org webhook config.
- Delivery logs.
- Retry failed deliveries.
- Subdomain routing.
- Custom domain planning and enforcement.

Exit criteria:

- An admin can configure a webhook URL and inspect delivery history.

## Milestone 9: Calendar and Dashboard

- Dashboard metrics and charts.
- Calendar month/day/week views.
- Calendar click/drag create.
- Calendar drag/drop reschedule and resize.

Exit criteria:

- The dashboard summarizes events and registrations.
- Calendar views can create and reschedule events.
