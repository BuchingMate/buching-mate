# Public Booking Pages

## Scope

Public booking pages are a first-class distribution channel for each organization.

Included:

- [~] Slug URL: `/book/:slug`. (superseded by clean `/events` paths under subdomain)
- [x] Subdomain URL: `{org}.domain.com`. (works via `*.lvh.me` in dev; admin moved to `/admin/*` so public owns `/events`)
- [ ] Custom domain support.
- [x] Public event search/filter. (client-side title/description search + category filter)
- [x] Public registration. (free events; paid events show contact-email alert)
- [~] SEO metadata. (page title via `head()`; OG/canonical/JSON-LD deferred)
- [~] Org branding. (logo + name in header; category color/icon deferred)

## Routing

MVP:

- [x] `/book/:slug`: public org event list. (now served at `/events` under subdomain)
- [x] `/book/:slug/events/:eventId`: event detail. (now `/events/:eventId` under subdomain)

Production target:

- [ ] `{orgSlug}.buching.app` resolves to the same public booking experience.
- [ ] Custom domains resolve by host lookup.

## Public API

- [x] `GET /api/public/orgs/:slug`: returns safe org details and settings.
- [x] `GET /api/public/orgs/:slug/events`: returns published upcoming events with counts.
- [x] `GET /api/public/orgs/:slug/events/:eventId`: returns event detail.
- [x] `POST /api/public/orgs/:slug/events/:eventId/register`: creates registration.
- [x] (extra) `POST /api/public/orgs/:slug/events/:eventId/checkout`.

## Public Data Rules

Expose only:

- [x] Org name, slug, logo.
- [x] Public-safe settings: categories, category configs, currency.
- [x] Published and upcoming event details.
- [x] Registration counts, not attendee lists.
- [x] Connected payment provider names, not account IDs.

## SEO

Each public page should set:

- [x] Title.
- [~] Description. (list page only)
- [ ] Canonical URL.
- [ ] Open Graph title/description.
- [ ] Structured data for event detail pages.

## Branding

Public pages use:

- [x] Org logo.
- [x] Org name.
- [ ] Category color/icon configuration.
- [x] Contact email where appropriate.
