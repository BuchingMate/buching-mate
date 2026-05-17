# Self-Host Buching Mate

Single-host deployment using Docker Compose. Runs the web app, API server, and Postgres on one machine.

## Requirements

- Docker 24+ and Docker Compose v2
- 2 GB RAM minimum (4 GB recommended)
- 5 GB disk for images + database growth

## Setup

```sh
cp .env.example .env
# edit .env — at minimum, set BETTER_AUTH_SECRET and POSTGRES_PASSWORD
docker compose pull
docker compose up -d
```

Open http://localhost:5678 to access the web app.
The server's API is on http://localhost:3456 (used by the web app).
The health endpoint is http://localhost:3456/health.

## Updating

```sh
docker compose pull
docker compose up -d
```

Database migrations run automatically on server container startup.

Pin to a specific release for predictable updates:

```sh
APP_VERSION=v1.2.0 docker compose up -d
```

## Auto-update (optional)

Add [Watchtower](https://containrrr.dev/watchtower/) to auto-pull new images:

```yaml
services:
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 3600 --cleanup
    restart: unless-stopped
```

Combine with `APP_VERSION=latest` and Watchtower will pull + redeploy whenever a new release ships.

## Reverse proxy + HTTPS

For production hosting, put a reverse proxy in front of the `web` and `server` ports. Examples: Caddy (auto-TLS), Traefik, nginx + Certbot. Set `WEB_URL`, `BETTER_AUTH_URL`, `VITE_SERVER_URL`, and `TRUSTED_ORIGINS` to the HTTPS public URLs after wiring TLS.

## Backups

The Postgres data lives in the `db-data` named volume. Back it up regularly:

```sh
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup-$(date +%F).sql.gz
```

Restore with:

```sh
gunzip -c backup-2026-05-16.sql.gz | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
```
