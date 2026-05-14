# Buching

Buching is a self-hostable event booking and registration platform for small teams, schools, studios, nonprofits, and service businesses.

Use it to publish events, manage attendees, accept registrations, organize resources, and run booking operations from your own infrastructure.

Buching is early-stage software. A public demo and production deployment guide are planned.

## What You Can Use It For

Buching is designed for organizations that run scheduled events or services, such as:

- classes and workshops
- school or community programs
- fitness, wellness, and studio sessions
- nonprofit events
- internal company events
- paid or free registrations

You can self-host Buching for your own organization and use it to support real commercial operations.

## Features

- Event creation and management
- Public event pages
- Attendee tracking
- Registration management
- Capacity and status tracking
- Organization settings
- Resource planning for instructors, rooms, materials, or equipment
- Email invitation foundation
- Webhook and payment foundations for future integrations

## Demo

A public demo is planned.

For now, you can run Buching locally by following the development setup below.

## License

Buching is licensed under the GNU Affero General Public License v3.0.

You may use, study, modify, distribute, and run the software commercially, including for your own business operations.

If you modify Buching and provide it to users over a network, the AGPL requires you to make the corresponding source code for your modified version available to those users.

See [`LICENSE`](./LICENSE) for the full license text.

## Commercial Use

You may use Buching to run your own business, including paid events, classes, workshops, or services.

The AGPL does not prohibit commercial use. It requires that modified network-deployed versions remain open under the same license.

## Trademarks

The Buching name and logo are not covered by the AGPL license. Forks and modified versions should use their own branding unless they have permission to use the Buching name.

## Deployment Model

Buching supports two intended deployment models:

- Self-hosted/community deployments for one organization.
- Hosted/cloud deployments where multiple organizations may be supported.

The self-hosted version is intended to be simple to operate: one deployment, one primary organization, controlled by the administrator of that deployment.

## Tech Stack

Buching is built with:

- React and Vite for the web app
- Hono and Bun for the API server
- PostgreSQL for data storage
- Drizzle ORM for database schema and migrations
- Turborepo for the monorepo workspace

## Local Development

### Requirements

- Bun
- Docker
- Docker Compose

### Setup

Clone the repository:

```bash
git clone https://github.com/peteqian/booking-mate.git
cd booking-mate
```

Copy the environment file:

```bash
cp .env.example .env
```

Run setup:

```bash
bun run setup
```

Start the app:

```bash
bun run dev
```

The app will run at:

- Web: http://localhost:5678
- Server: http://localhost:3456
- Database: localhost:5433

## Environment Variables

The default development environment uses PostgreSQL through Docker.

Important variables:

```env
DATABASE_URL=postgresql://buching:buching_password@localhost:5433/buching
SERVER_PORT=3456
WEB_PORT=5678
WEB_URL=http://localhost:5678
VITE_SERVER_URL=http://localhost:3456
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3456
```

For production, use strong secrets, HTTPS URLs, managed backups, and a properly secured PostgreSQL database.

## Production Status

Buching is not yet recommended for unattended production use.

Before using it in production, review:

- authentication configuration
- database backups
- email delivery
- HTTPS and reverse proxy setup
- environment secrets
- upgrade and migration process
- monitoring and logs

A production deployment guide is planned.

## Project Structure

```txt
booking-mate/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── server/       # Hono + Bun API server
├── packages/
│   └── contracts/    # Shared TypeScript types
├── scripts/
│   └── setup.ts      # Local setup script
├── docker-compose.yml
└── turbo.json
```

## Development Commands

```bash
bun run dev
bun run build
bun run lint
bun run format:check
bun run typecheck
```

Database commands:

```bash
bun run db:up
bun run db:down
bun run db:logs
```

Server migration commands:

```bash
cd apps/server
bun run db:generate
bun run db:migrate
```

## Contributing

Contributions are welcome.

Before opening a pull request, run:

```bash
bun run lint
bun run format:check
bun run typecheck
```

A contribution guide and code of conduct may be added as the project matures.

## Security

Please do not report security issues through public GitHub issues.

A security policy and disclosure contact will be added before a public production release.

## Roadmap

Planned areas of work include:

- production Docker images
- hosted demo
- improved onboarding
- payment integrations
- email templates
- production deployment guide
- stronger admin controls
- observability and audit logs
