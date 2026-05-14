# Server API

## Goals

- Move all domain reads/writes through Hono.
- Validate request bodies at the edge.
- Enforce org ownership and role permissions server-side.
- Keep public booking APIs unauthenticated but tightly scoped.

## Implementation Position

Implement route groups in product-flow order:

1. `/api/org` enough to create/resolve the active organization and read/update minimal settings.
2. `/api/events` enough to create, list, read, update, delete, and duplicate events.
3. `/api/resources` and event resource assignment.
4. `/api/attendees` and `/api/registrations`.
5. `/api/public` for published org/event discovery and public registration.
6. `/api/payments` and `/api/webhooks` when commercial/integration milestones begin.

Avoid completing integration routes early with fake behavior. Use explicit placeholders only at external provider boundaries.

## Middleware

### `requireAuth`

Reads Better Auth session from request and sets `user` in context.

### `requireOrg`

For single-org UX, resolve the user's organization automatically unless an explicit `X-Org-Id` is supplied.

Responsibilities:

- Confirm membership.
- Set `orgId`, `memberRole`, and `org` in context.
- Reject cross-org access.

### `requireRole`

Role hierarchy:

- `viewer`: read dashboard, events, attendees, registrations.
- `manager`: create/update events, resources, attendees, registrations.
- `admin`: delete resources, manage settings, invite/remove members, payment/webhook config.
- `owner`: delete organization, transfer ownership, full control.

### `requirePlanLimit`

Manual plan limits only. No Polar checkout yet.

## Route Groups

### `/api/org`

- `GET /api/org`: current user's org.
- `POST /api/org`: create org during onboarding.
- `GET /api/org/settings`.
- `PATCH /api/org/settings`.
- `GET /api/org/members`.
- `POST /api/org/invites`.
- `PATCH /api/org/members/:memberId`.
- `DELETE /api/org/members/:memberId`.
- `DELETE /api/org/invites/:inviteId`.

### `/api/resources`

- `GET /api/resources?type=`.
- `POST /api/resources`.
- `GET /api/resources/:resourceId`.
- `PATCH /api/resources/:resourceId`.
- `DELETE /api/resources/:resourceId`.

### `/api/events`

- `GET /api/events`.
- `POST /api/events`.
- `GET /api/events/:eventId`.
- `PATCH /api/events/:eventId`.
- `DELETE /api/events/:eventId`.
- `POST /api/events/:eventId/duplicate`.
- `GET /api/events/:eventId/registrations`.
- `GET /api/events/:eventId/resources`.
- `PUT /api/events/:eventId/resources`.

### `/api/attendees`

- `GET /api/attendees?search=`.
- `POST /api/attendees`.
- `GET /api/attendees/:attendeeId`.
- `PATCH /api/attendees/:attendeeId`.

### `/api/registrations`

- `GET /api/registrations`.
- `POST /api/registrations`.
- `PATCH /api/registrations/:registrationId`.
- `DELETE /api/registrations/:registrationId`.

### `/api/public`

- `GET /api/public/orgs/:slug`.
- `GET /api/public/orgs/:slug/events`.
- `GET /api/public/orgs/:slug/events/:eventId`.
- `POST /api/public/orgs/:slug/events/:eventId/register`.
- `POST /api/public/orgs/:slug/events/:eventId/checkout`.

### `/api/payments`

- `GET /api/payments/providers`.
- `GET /api/payments/connections`.
- `POST /api/payments/connect`.
- `GET /api/payments/callback/:provider`.
- `DELETE /api/payments/connections/:connectionId`.
- `POST /api/payments/webhooks/:provider`.

### `/api/webhooks`

- `GET /api/webhooks`.
- `GET /api/webhooks/:deliveryId`.
- `POST /api/webhooks/:deliveryId/retry`.
- `POST /api/webhooks/secret/regenerate`.

## Error Shape

Return consistent JSON:

```json
{ "error": { "code": "event_not_found", "message": "Event not found" } }
```

Use flat error codes that are stable for the frontend.
