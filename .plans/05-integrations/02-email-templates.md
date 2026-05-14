# Email Templates

## Scope

Organizations can configure email copy for key lifecycle messages.

Included:

- Invite email template.
- Registration confirmation template.
- Waitlist template.
- Payment confirmation template.
- Cancellation template.

## Storage

Store templates in `org_settings.emailTemplates` as JSON.

Example keys:

- `invite`.
- `registrationConfirmed`.
- `registrationWaitlisted`.
- `paymentConfirmed`.
- `registrationCancelled`.

## Variables

Support a small variable set:

- `{{orgName}}`.
- `{{eventTitle}}`.
- `{{eventDate}}`.
- `{{eventTime}}`.
- `{{attendeeName}}`.
- `{{bookingUrl}}`.

## UI

Settings email templates tab:

- Template selector.
- Subject input.
- Body textarea.
- Preview with sample data.
- Save/reset controls.

## Safety

- Escape variables by default.
- Avoid arbitrary HTML until sanitization is deliberately added.
- Keep default templates usable if org has not customized anything.
