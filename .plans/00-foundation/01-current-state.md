# Current State

## Workspace

Buching is a Turborepo monorepo using Bun.

- `apps/web`: React, Vite, TanStack Router, Tailwind CSS, Base UI-style local components.
- `apps/server`: Hono, Bun runtime, Better Auth, Drizzle, PostgreSQL.
- `packages/contracts`: shared TypeScript interfaces.

## Implemented Today

- Better Auth email/password flow.
- Better Auth organization plugin wiring.
- Organization onboarding route.
- Signup, login, invite acceptance, settings pages.
- Auth database tables and Better Auth organization tables.
- Minimal Hono server with `/`, `/health`, and `/api/auth/*`.
- Basic owner/admin organization permission statement.

## Gaps

- No domain schema for events, resources, attendees, registrations, payments, webhooks, or plan limits.
- No domain API routes outside Better Auth.
- No app shell for event management, resource management, calendar, dashboard, or public booking.
- No shared contracts for domain payloads.
- Settings only covers simple org details, member listing, invite, billing placeholder, and deletion.

## Planning Constraint

Preserve the current monorepo and Hono/Bun/Drizzle direction. Reference projects are sources of product behavior and schema/API inspiration, not a direct copy target.
