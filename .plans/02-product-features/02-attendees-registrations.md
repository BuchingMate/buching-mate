# Attendees and Registrations

## Scope

Attendees are people who register for events. Registrations link attendees to events.

Included:

- [x] Email required.
- [x] Duplicate prevention.
- [x] Manual attendee creation.
- [x] Registration statuses.
- [x] Payment statuses.
- [x] Capacity and waitlist behavior.

## Attendee Rules

- [x] Attendee email is required.
- [x] Email is normalized to lowercase.
- [x] `(orgId, email)` is unique. (uniqueIndex `attendees_org_email_idx`)
- [x] Phone is optional.

## Registration Rules

- [x] One active registration per attendee per event.
- [x] Cancelled registrations do not block future registration.
- [x] If confirmed registration count is below event capacity, new registration is `confirmed`.
- [x] If event is full, new registration is `waitlisted`.
- [x] Free events get `paymentStatus = not_required`.
- [x] Paid events get `paymentStatus = pending` until provider confirms payment.

## Statuses

Registration status:

- [x] `confirmed`.
- [x] `waitlisted`.
- [x] `cancelled`.

Payment status:

- [x] `not_required`.
- [x] `pending`.
- [x] `paid`.
- [x] `refunded`.
- [x] `expired`.

## Public Registration Flow

Server endpoint: [x] `POST /api/public/orgs/:slug/events/:eventId/register`. Public web pages: [x] implemented (`events.index.tsx`, `events.$eventId.index.tsx`, `events.$eventId.book.tsx`).

1. [x] Visitor opens public event. (`/events/:eventId` under subdomain)
2. [x] Visitor enters name, email, and optional phone. (`/events/:eventId/book` form)
3. [x] Server resolves or creates attendee by email.
4. [x] Server checks duplicate active registration.
5. [x] Server checks capacity and assigns registration status.
6. [x] Server assigns payment status.
7. [ ] If paid and provider is connected, frontend proceeds to checkout. (book page shows "Paid registration is not available yet" alert; no checkout UI wired)

## Team Registration Flow

- [x] Managers can manually create attendees and registrations from the dashboard.

## Waitlist Promotion

Initial behavior:

- [x] Cancelled confirmed registrations free capacity.
- [x] Manual promotion from waitlisted to confirmed is acceptable for MVP.

Later behavior:

- [ ] Auto-promote oldest waitlisted attendee when capacity opens.
- [ ] Notify promoted attendee via email template.
