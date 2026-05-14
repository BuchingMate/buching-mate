# Migration Notes

## Database

After schema changes:

1. Run `bun run db:generate` from `apps/server`.
2. Review generated migration.
3. Run `bun run db:migrate` from `apps/server`.

## Auth Tables

Avoid destructive changes to Better Auth-generated tables unless required.

If extending organization behavior, prefer adjacent domain tables such as `org_settings` rather than changing auth plugin expectations.

## Existing App Routes

Current routes can be evolved:

- `/` becomes dashboard.
- `/onboarding` becomes multi-step onboarding.
- `/settings` becomes tabbed settings.
- `/invite/:invitationId` remains invite acceptance.

Add routes:

- `/events`.
- `/calendar`.
- `/resources`.
- `/attendees`.
- `/book/:slug`.
- `/book/:slug/events/:eventId`.

## Environment

Add env vars incrementally:

- Payment vars when Stripe work starts.
- Webhook/job vars when delivery workers are introduced.
- Domain/root URL vars when subdomains are implemented.
