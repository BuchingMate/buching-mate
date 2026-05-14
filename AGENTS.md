# Buching - Agent Instructions

## Project Overview

A Turborepo monorepo with a React frontend (web) and Hono/Bun backend (server), sharing TypeScript contracts.

## Workspace Structure

```
booking-mate/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── server/       # Hono + Bun API server
├── packages/
│   └── contracts/    # Shared TypeScript interfaces
├── scripts/
│   └── setup.ts      # One-time project setup
├── docker-compose.yml
├── .env
└── turbo.json
```

## Tech Stack

- **Package Manager**: Bun
- **Monorepo**: Turborepo
- **Frontend**: React 19, Vite, Tailwind CSS, Base UI
- **Backend**: Hono, Bun runtime
- **Database**: PostgreSQL (Docker), Drizzle ORM
- **Linting**: Oxlint
- **Formatting**: Oxfmt

## Environment

Copy `.env.example` to `.env` and configure:

```bash
# Database
POSTGRES_USER=buching
POSTGRES_PASSWORD=buching_password
POSTGRES_DB=buching
DATABASE_URL=postgresql://buching:buching_password@localhost:5433/buching

# Application Ports
SERVER_PORT=3456
WEB_PORT=5678
```

## Common Commands

```bash
# Initial setup (starts db, installs deps, runs migrations)
bun run setup

# Start development (runs web + server)
bun run dev

# Database
bun run db:up       # Start Postgres container
bun run db:down     # Stop Postgres container
bun run db:logs     # View database logs

# Code quality
bun run lint        # Run oxlint
bun run lint:fix    # Fix lint issues
bun run format      # Format with oxfmt
bun run format:check # Check formatting
bun run typecheck   # TypeScript check
bun run build       # Production build
```

## Database

### Server-specific commands

```bash
cd apps/server
bun run db:generate   # Generate Drizzle migrations
bun run db:migrate    # Apply migrations
bun run db:studio     # Open Drizzle Studio
```

### Schema

Database schema lives in `apps/server/src/db/schema.ts`. After modifying:

1. Run `bun run db:generate` to create migration
2. Run `bun run db:migrate` to apply it

## Ports

- **Web**: http://localhost:5678
- **Server**: http://localhost:3456
- **Database**: localhost:5433 (mapped from container's 5432)

## Local Subdomain Testing

- Use `lvh.me` for local org-subdomain testing because wildcard subdomains resolve to `127.0.0.1`.
- Example: `http://demo-org-zt1fbr.lvh.me:5678/events`.
- Do not rely on `traefik.me` for local development; public DNS can fail before the app receives the request.

## Conventions

- Use `workspace:*` for internal package dependencies
- Server reads env from root `.env` via `--env-file=../../.env`
- Shared types go in `packages/contracts/src/index.ts`
- Run `bun run lint` and `bun run format:check` before committing

### Frontend Route Structure

- Keep TanStack Router route files as thin route modules: route declaration, loader/beforeLoad, params/context plumbing, and rendering a feature component.
- Do not export reusable feature UI from a route file for another route to import. This route/component coupling makes routes hard to move and can accidentally turn shared UI into route modules.
- Put route-local reusable UI under the route directory in `~components/`.
- Example: shared Events UI belongs in `apps/web/src/routes/events/~components/`, while `apps/web/src/routes/events/$eventId/index.tsx` and `apps/web/src/routes/events/$eventId/edit.tsx` should remain small wrappers.
- Keep truly shared app-wide UI in `apps/web/src/components/`; do not promote route-specific components there prematurely.

## Git

- Default branch: `main`
- Author: Peter Qian <peter.qian.dev@gmail.com>
- Remote: https://github.com/peteqian/booking-mate
