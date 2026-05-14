# Events

## Scope

Events are the primary user-facing booking object.

Events are the second product milestone after organization activation. The first useful loop is: create organization, create event, see event in dashboard.

Included:

- [x] CRUD.
- [x] Publish/unpublish/archive visibility.
- [x] Status lifecycle: upcoming, completed, cancelled.
- [x] Capacity.
- [x] Waitlist support through registrations.
- [x] Recurrence fields. (schema only; expansion logic deferred)
- [x] Kanban view.
- [x] Table filters and sorting.
- [x] Duplicate event.
- [x] Resource assignments.
- [x] Price field for paid events.

## Event Fields

Required:

- [x] Title. (max 127 chars — used as payment line item name; PayPal hard limit)
- [x] Date.
- [x] Time.
- [x] Duration.
- [x] Max capacity.
- [x] Category.
- [x] Visibility.

Optional:

- [x] Description.
- [x] Location text.
- [x] Assigned location resource.
- [x] Assigned instructor resources.
- [x] Assigned material resources.
- [x] Price.
- [x] Recurrence settings. (fields stored)

## Behavior

- [x] New events default to `upcoming` and `unpublished`.
- [~] Published events appear on public booking pages if status is `upcoming`. (server-side rule present; public web pages missing)
- [x] Archived events remain visible to team members but not public visitors.
- [x] Cancelled events are hidden from public booking by default.
- [x] Duplicate creates a new upcoming event with copied fields and no registrations.

## Recurrence

MVP stores recurrence configuration on the event. Expansion into individual generated event instances can be deferred until recurring behavior must support per-instance edits.

Plan for:

- [x] `daily`, `weekly`, `biweekly`, `monthly`, `yearly`, `custom`. (recurrenceFrequency text field)
- [x] Interval.
- [x] Days of week.
- [x] End date.

## UI

Events page:

- [x] Search by title and description.
- [x] Filter by category.
- [x] Filter by status.
- [x] Filter by visibility.
- [x] Toggle table/kanban.
- [x] Create/edit modal.
- [x] Detail modal with registrations, resources, payment status, and actions.

Kanban:

- [x] Columns: upcoming, completed, cancelled.
- [x] Drag/drop updates status.

Table:

- [x] Sort by title, date, status, registration count, visibility, category, price, location.

## Permissions

- [x] Viewer: read.
- [x] Manager: create/update/duplicate.
- [x] Admin: delete.
- [x] Owner: all.
