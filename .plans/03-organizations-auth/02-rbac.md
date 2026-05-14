# Role-Based Access Control

## Scope

Use a four-role hierarchy.

- Viewer.
- Manager.
- Admin.
- Owner.

## Permissions

### Viewer

- View dashboard.
- View events.
- View resources.
- View attendees.
- View registrations.

### Manager

Includes Viewer plus:

- Create/update events.
- Duplicate events.
- Create/update resources.
- Create/update attendees.
- Create/update registrations.
- Manage event resource assignments.

### Admin

Includes Manager plus:

- Delete events.
- Delete resources.
- Manage settings.
- Invite members.
- Remove members.
- Configure payments.
- Configure webhooks.

### Owner

Includes Admin plus:

- Delete organization.
- Transfer ownership later.
- Full control.

## Implementation

- Define permission map in server auth/permissions module.
- Mirror readable permission helpers in web only for hiding/showing UI.
- Server permission checks are authoritative.

## UI

- Hide actions the user cannot perform.
- Show access-denied states for direct route access.
- Avoid relying only on frontend guards.
