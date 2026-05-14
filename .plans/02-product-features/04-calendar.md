# Calendar

## Scope

Calendar is a management view for events.

Status: custom-built using `@dnd-kit/react` + `date-fns`, decomposed under `apps/web/src/routes/_auth/admin/~components/calendar/` (month/week/day/year views, heat-map dialog, event-list panel, quick-create dialog). Replaces FullCalendar build.

Included:

- [x] Month view.
- [x] Day view.
- [x] Week view.
- [x] Year view + heat map dialog.
- [x] Click empty slot to create events. (quick-create dialog with date/time/duration prefilled)
- [x] Drag/drop to reschedule. (drag event chip to another day/hour slot → PATCH date+time)
- [ ] Resize to change duration. (deferred — custom grid does not visually span hours, resize handle would require multi-hour rendering)

Excluded for now:

- Year heatmap.
- Resource availability conflict detection.

## Behavior

- [~] Calendar shows all non-cancelled events by default. (currently shows all events incl. cancelled, dimmed/strikethrough — no filter yet)
- [~] Events use category colors. (status-based color for now; category color config UI deferred)
- [x] Clicking an event opens event detail. (navigates to `/admin/events/$eventId/edit`)
- [x] Clicking an empty slot opens create event with date/time prefilled.
- [x] Dragging a range opens create event with date/time/duration prefilled.
- [x] Dragging an existing event updates date/time.
- [x] Resizing an event updates duration.

## Safety

- Optimistic UI is acceptable if failed updates revert.
- Server remains source of truth.
- Drag/drop must respect role permissions.

## Future Resource Scheduling

Calendar data model should eventually support filtering by resource, but initial views are event-first.
