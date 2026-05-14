# Domain Schema

## Goals

- Add first-class domain tables without disrupting Better Auth tables.
- Keep org scoping explicit everywhere.
- Support events first while treating resources as a core primitive.
- Leave room for appointment scheduling later.

## Implementation Position

Do not treat the full schema as a standalone first milestone. Add tables in the order they unlock product flow:

1. Organization settings for onboarding and active-org context.
2. Events for the first create/view loop.
3. Resources and `event_resources` for event enrichment.
4. Attendees and registrations for booking management.
5. Payment and webhook tables when commercial/integration work begins.

It is acceptable to create several related tables in one migration for development convenience, but implementation and UI work should still follow this hierarchy.

## Enums

- `org_role`: `owner`, `admin`, `manager`, `viewer`.
- `org_plan`: `free`, `pro`.
- `event_status`: `upcoming`, `completed`, `cancelled`.
- `event_visibility`: `published`, `unpublished`, `archived`.
- `registration_status`: `confirmed`, `waitlisted`, `cancelled`.
- `payment_status`: `not_required`, `pending`, `paid`, `refunded`, `expired`.
- `resource_type`: `instructor`, `material`, `location`, `equipment`, `custom`.
- `webhook_delivery_status`: `pending`, `delivered`, `failed`, `dead_letter`.

## Tables

### `org_settings`

One row per organization.

Fields:

- `id`, `orgId`.
- `contactEmail`.
- `currency`, default `USD`.
- `categories`, JSON or text array.
- `categoryConfigs`, JSON.
- `logoUrl` or keep logo on Better Auth `organization.logo`.
- `webhookUrl`, `webhookSecret`.
- `emailTemplates`, JSON.
- timestamps.

### `resources`

Generalized resource table.

Fields:

- `id`, `orgId`.
- `type`.
- `name`.
- `description`.
- `email`, `phone` for people resources.
- `capacity` for locations.
- `url` for materials or virtual resources.
- `metadata`, JSON.
- timestamps.

### `events`

Fields:

- `id`, `orgId`, `createdById`.
- `title`, `description`, `category`.
- `date`, `time`, `duration`.
- `maxCapacity`, `location`.
- `status`, `visibility`.
- Recurrence fields: `recurring`, `recurrenceFrequency`, `recurrenceDays`, `recurrenceInterval`, `recurrenceEndDate`.
- `price`.
- timestamps.

### `event_resources`

Join table for assigning resources to events.

Fields:

- `id`, `orgId`, `eventId`, `resourceId`.
- `role`, such as `instructor`, `location`, `material`, `support`.
- `quantity` for materials/equipment.
- timestamps.

### `attendees`

Fields:

- `id`, `orgId`.
- `name`, `email`, `phone`.
- timestamps.

Constraints:

- Unique `(orgId, email)`.
- Email is required in current scope.

### `registrations`

Fields:

- `id`, `orgId`, `eventId`, `attendeeId`.
- `status`.
- `paymentStatus`.
- `checkoutSessionId`, `paymentProvider`.
- timestamps.

Constraints:

- Prevent duplicate active registration for `(eventId, attendeeId)` where status is not cancelled. If partial indexes are awkward in Drizzle, enforce in service logic first and add database constraint later.

### `payment_connections`

Fields:

- `id`, `orgId`.
- `provider`, `accountId`, `status`.
- `metadata`.
- timestamps.

Constraints:

- Unique `(orgId, provider)`.

### `webhook_deliveries`

Fields:

- `id`, `orgId`.
- `eventType`, `payload`.
- `status`, `attempts`, `maxAttempts`.
- `lastAttemptAt`, `lastError`, `responseStatus`, `durationMs`, `deliveredAt`.
- timestamps.

## Migration Strategy

1. Add domain schema in `apps/server/src/db/schema.ts` alongside exported auth schema.
2. Generate a Drizzle migration.
3. Add indexes for common org-scoped access patterns.
4. Keep any destructive auth-table changes out of this phase.
