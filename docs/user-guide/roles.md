# Roles and permissions

Buching has four organization roles. Each member of an organization is assigned exactly one role, which controls what they can see and do inside that organization. Roles are scoped per organization — being an owner of one org does not grant access to another.

## At a glance

| Capability | Owner | Admin | Manager | Viewer |
|---|---|---|---|---|
| View events, attendees, registrations | ✓ | ✓ | ✓ | ✓ |
| Create and edit events | ✓ | ✓ | ✓ | ✗ |
| Delete events | ✓ | ✓ | ✗ | ✗ |
| Manage attendees and registrations | ✓ | ✓ | ✓ | ✗ |
| Manage resources (instructors, locations, etc.) | ✓ | ✓ | ✓ | ✗ |
| Delete resources | ✓ | ✓ | ✗ | ✗ |
| Change organization settings (general, categories) | ✓ | ✓ | ✗ | ✗ |
| Invite and remove members | ✓ | ✓ | ✗ | ✗ |
| Manage payment providers (Stripe Connect) | ✓ | ✗ | ✗ | ✗ |
| Manage outbound webhooks | ✓ | ✗ | ✗ | ✗ |
| Manage connected apps (Zapier, OAuth integrations) | ✓ | ✗ | ✗ | ✗ |
| Manage billing and subscription | ✓ | ✗ | ✗ | ✗ |
| Delete the organization | ✓ | ✗ | ✗ | ✗ |

## When to use each role

### Owner

The person ultimately responsible for the organization, its money, and its integrations. Owners can do everything an admin can, plus connect payment providers, configure outbound webhooks and connected apps, manage billing, and permanently delete the organization. Most orgs have a single owner — usually the founder or business owner who signed up.

Pick this when: setting up the org for the first time, or transferring ownership to a new responsible person.

### Admin

Trusted operators who run the day-to-day and configure the organization. Admins can change general settings, invite members, manage categories, and delete events or resources. Admins **cannot** connect payment providers, manage webhooks or connected apps, change billing, or delete the organization — those stay with the owner so the person on the hook for money and integrations is the one who controls them.

Pick this when: a manager-level employee or co-founder needs full operational control without touching financial or third-party integrations.

### Manager

Front-line staff running events and looking after attendees. Managers can create and edit events, manage attendees and registrations, and add resources — but cannot delete things or change organization settings.

Pick this when: an employee runs sessions or handles bookings but should not change billing, integrations, or destroy data.

### Viewer

Read-only access. Viewers can browse the dashboard but cannot make changes.

Pick this when: a stakeholder needs visibility (e.g. an accountant, a board member, an auditor) without any ability to edit.

## Choosing the right role

A useful rule of thumb:

- If they pay the bills → **Owner**.
- If they configure the product → **Admin**.
- If they run events → **Manager**.
- If they only need to see what's happening → **Viewer**.

When in doubt, start with the lower-privilege role. You can promote later from organization settings → members.

## Changing or removing roles

Admins and owners can change a member's role from organization settings → members. Owners can demote themselves only if another owner exists; the last owner cannot leave or be removed.

## Notes for support

- Role is stored on the membership row, not on the user. The same person can hold different roles across different organizations.
- The `viewer` role is the default fallback when permissions are unclear; if a user reports missing actions, check their role first.
