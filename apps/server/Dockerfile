# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=${BUILD_VERSION}

COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/seo/package.json ./packages/seo/

RUN bun install --frozen-lockfile

COPY packages/contracts ./packages/contracts
COPY packages/seo ./packages/seo
COPY apps/server ./apps/server

WORKDIR /app/apps/server
RUN bun run build \
  && bun build src/db/migrate.ts --target bun --production --outdir dist

# ---- runtime stage ----
FROM oven/bun:1.3.14-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=${BUILD_VERSION}

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/src/db/migrations ./src/db/migrations
COPY --from=builder /app/apps/server/package.json ./package.json

COPY apps/server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3456
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "dist/index.js"]
