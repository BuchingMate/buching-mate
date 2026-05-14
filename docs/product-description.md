# Product Description

Buching is a hybrid event booking SaaS for organizations that run classes, workshops, programs, sessions, or other scheduled offerings.

The main public-facing object is an event: something people can browse and register for. Internally, the platform treats the things needed to run those events as resources, such as instructors, locations, materials, equipment, or other custom assets. This keeps the product event-first today while leaving room for future appointment-style or resource-availability booking later.

Organizations use Buching to create events, manage attendees, track registrations, assign resources, accept payments, share public booking pages, and monitor operational activity.

## Target Users

- Training academies.
- Studios and instructors.
- Workshop organizers.
- Community groups.
- Schools or small education programs.
- Businesses that run public or private events.
- Teams that need lightweight event/resource booking without a full enterprise system.

## Core Product Areas

### Events

Events are the primary booking unit.

Features:

- Create, edit, delete events.
- Publish, unpublish, or archive events.
- Track event status: upcoming, completed, cancelled.
- Set date, time, duration, location, category, capacity, and price.
- Support recurring events.
- Duplicate existing events.
- View events in table mode.
- View events in kanban mode.
- Filter and sort events by category, status, visibility, date, price, and registration count.

### Resources

Resources are the things used to run events.

Features:

- Manage instructors.
- Manage materials.
- Manage locations.
- Support custom resource types.
- Assign resources to events.
- Store resource-specific details like bio, email, phone, URL, address, capacity, notes, and metadata.

This is important because the product is not just events. It is a booking system where events are composed from reusable resources.

### Public Booking Pages

Each organization gets a public-facing booking experience.

Features:

- Public booking page at `/book/:slug`.
- Future support for `{org}.buching.app` subdomains.
- Future support for custom domains.
- Public event browsing.
- Search and filter public events.
- Public event detail pages.
- Public registration without requiring an attendee account.
- Organization branding on public pages.
- SEO metadata for public pages and events.

### Attendees and Registrations

Attendees are people who sign up for events. Registrations connect attendees to events.

Features:

- Email-required attendee records.
- Optional phone numbers.
- Manual attendee creation by team members.
- Public attendee registration.
- Duplicate registration prevention.
- Registration statuses: confirmed, waitlisted, cancelled.
- Payment statuses: not required, pending, paid, refunded, expired.
- Capacity-aware registration.
- Automatic waitlist when an event is full.

### Organizations and Teams

The initial product is single-organization per user, but the data model remains org-scoped for future multi-org support.

Features:

- Organization onboarding.
- Organization settings.
- Team invites.
- Role hierarchy.
- Public booking slug.
- Contact email.
- Logo and branding.
- Categories and category styling.
- Currency settings.

Roles:

- Viewer: read-only access.
- Manager: create and edit events, resources, attendees, registrations.
- Admin: manage settings, invites, deletions, payments, webhooks.
- Owner: full control, including organization-level destructive actions.

### Payments

Payments are for organizations that charge attendees for paid events.

Features:

- Provider-agnostic payment architecture.
- Stripe Connect as first provider.
- Future support for PayPal or Square.
- Organization-owned payment connections.
- Paid event checkout after registration.
- Multi-provider payment design.
- Payment webhook reconciliation.
- Refund handling.
- Expired pending payment handling.
- Payment status shown in event and registration views.

Important distinction: Buching is not planning SaaS subscription billing yet. It will have plan limits, but not Polar/Stripe billing for Buching subscriptions in the first scope.

### Plan Limits

Plans are manually enforced for now.

Example Free plan limits:

- Limited published events.
- Limited team members.
- No custom domains.
- No org webhooks.

Example Pro plan:

- More or unlimited published events.
- More team members.
- Custom domains.
- Webhooks.
- Advanced payment/provider capabilities.

### Webhooks

Organizations can configure webhook endpoints to receive event updates.

Features:

- Org webhook URL.
- Signing secret.
- Signed webhook payloads.
- Delivery logs.
- Failed delivery inspection.
- Manual retry.
- Registration and payment webhook events.

Example webhook events:

- `registration.created`.
- `registration.cancelled`.
- `registration.waitlisted`.
- `registration.payment.completed`.
- `registration.payment.refunded`.
- `registration.payment.expired`.

### Email Templates

Organizations can customize key outbound messages.

Features:

- Invite email template.
- Registration confirmation template.
- Waitlist template.
- Payment confirmation template.
- Cancellation template.
- Template variables such as org name, event title, event date, attendee name, and booking URL.

### Dashboard

The dashboard gives the organization a fast operational overview.

Features:

- Total events.
- Upcoming events.
- Events this week.
- Confirmed registrations.
- Attendance or capacity utilization.
- Registrations over time.
- Events by category.
- Revenue summary when paid events exist.
- Upcoming event list.

### Calendar

Calendar is an internal event management view.

Features:

- Month view.
- Week view.
- Day view.
- Click to create event.
- Drag to create event range.
- Drag/drop to reschedule.
- Resize to change duration.
- Category-colored events.

### Settings

Settings will centralize organization configuration.

Sections:

- Organization details.
- Team management.
- Categories.
- Branding.
- Payments.
- Webhooks.
- Email templates.
- Plan limits.

## Deferred

- Appointment scheduler as the main product.
- SaaS subscription billing for Buching itself.
- i18n.
- Multi-org switcher.
- Resource availability conflict detection.
- Year heatmap calendar.
- Full custom-domain operations and SSL automation.
- Redis/BullMQ queues unless needed for webhook/payment reliability.

## Positioning

Buching is an event-first booking platform for organizations that need to manage public events, registrations, resources, payments, and team operations from one place.

Tagline:

> Event booking, resource management, and registrations for teams that run scheduled experiences.
