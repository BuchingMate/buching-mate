# App Shell and Navigation

## Scope

Authenticated app needs a consistent shell for event/resource operations.

## Navigation

Primary items:

- Dashboard.
- Events.
- Calendar.
- Resources.
- Attendees.
- Settings.

Conditional items:

- Payments inside Settings integrations.
- Webhook logs inside Settings.

## Layout

- Sidebar on desktop.
- Mobile sheet/drawer navigation.
- Header with org name, plan badge, and user menu.
- No multi-org switcher yet.

## Route Protection

- Authenticated routes require session.
- Onboarding required if no org.
- Permission-denied state for insufficient role.
