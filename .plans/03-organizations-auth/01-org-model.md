# Organization Model

## Scope

Buching should start with one organization per user account in the product experience.

The database and APIs remain org-scoped to support future multi-org behavior.

## Current Fit

The current app already creates organizations through Better Auth organization plugin. Keep using Better Auth for user/session/auth mechanics.

## Product Rules

- A new user must create or join an organization before using the dashboard.
- The app treats the user's first/current organization as active.
- Public pages are resolved by organization slug or host.
- Organization slug should be immutable after creation unless a dedicated rename flow is added.

## Implementation Priority

Organization activation is the first product milestone. Do this before event/resource UI work:

1. User signs up or logs in.
2. Server detects whether the user belongs to an organization.
3. User creates or joins one organization.
4. App redirects into the authenticated org-scoped dashboard.
5. All domain APIs resolve and enforce that active organization.

Team invites and rich settings can follow after the first event creation flow is usable.

## Organization Settings

Settings include:

- Name.
- Slug.
- Contact email.
- Logo/branding.
- Currency.
- Event categories and category configs.
- Webhook URL and secret.
- Email templates.

## Future Multi-Org Path

To add multi-org support later:

- Add org switcher to app shell.
- Persist active org in session or user preference.
- Require explicit org selection for API calls.
- Keep route handlers already org-scoped.
