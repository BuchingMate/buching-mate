# Resources

## Scope

Resources are first-class. Events are visible booking objects, but resources are the underlying things assigned to events and future booking flows.

Status: backend resource service + API + schema with `resourceType` enum (instructor/material/location/equipment/custom) implemented. Frontend management page lives at `/_auth/admin/resources/index.tsx` with tabs per type, search, archive, type-conditional create/edit, delete, and a detail page (`$resourceId.tsx`) listing event usages.

Included:

- [x] Instructors.
- [x] Materials.
- [x] Locations.
- [x] Equipment.
- [x] Custom resource types.
- [x] Assign resources to events.

## Resource Types

### Instructor

Fields:

- Name.
- Email.
- Phone.
- Bio.
- Metadata.

### Material

Fields:

- Name.
- Description.
- URL.
- Quantity or metadata.

### Location

Fields:

- Name.
- Address.
- Capacity.
- Notes.

### Equipment

Fields:

- Name.
- Description.
- Capacity (pool size).
- URL.
- Cost (rental).

### Custom

Fields:

- Name.
- Description.
- Metadata.

## Event Assignment

- [x] Events can have many resources through `event_resources`.

Examples:

- [x] One primary instructor.
- [x] One location.
- [x] Multiple materials.
- [x] Equipment quantity.

## UI

Resources page:

- [x] Tabs or filter chips for resource types.
- [x] Create/edit/delete resource.
- [x] Search resources.
- [x] Basic list/table per type.
- [x] Archive/unarchive (soft hide).
- [x] Detail page with usage list.

Event form:

- [x] Assign instructor resources.
- [x] Assign location resource.
- [x] Assign material resources.

## Deferred

- Availability calendars.
- Conflict detection.
- Resource-specific booking pages.
- Appointment scheduling.
