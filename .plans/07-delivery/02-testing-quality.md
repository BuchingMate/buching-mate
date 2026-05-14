# Testing and Quality

## Required Commands

Run before merging implementation work:

- `bun run lint`.
- `bun run format:check`.
- `bun run typecheck`.
- `bun run build`.

## Server Tests

Prioritize tests for:

- Permission enforcement.
- Org scoping.
- Event CRUD.
- Public registration duplicate prevention.
- Capacity and waitlist transitions.
- Payment webhook reconciliation.
- Webhook signing.

## Frontend Tests

Prioritize tests for:
- Event form validation.
- Public registration form.
- Permission-gated UI.
- Calendar date/time update behavior.

## Manual QA Flows

- New user signup -> onboarding -> create first event.
- Publish event -> open public page -> register attendee.
- Full event -> next attendee becomes waitlisted.
- Manager can edit event but cannot delete org.
- Admin can invite member and manage settings.
- Paid event -> checkout -> webhook marks paid.
- Failed webhook delivery appears in logs and can retry.
