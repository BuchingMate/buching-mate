# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=${BUILD_VERSION}

COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/seo/package.json ./packages/seo/

RUN bun install --frozen-lockfile

COPY packages/contracts ./packages/contracts
COPY packages/seo ./packages/seo
COPY apps/web ./apps/web

WORKDIR /app/apps/web
ENV NITRO_PRESET=node-server
RUN bun run build

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5678
ENV HOST=0.0.0.0

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=${BUILD_VERSION}

COPY --from=builder /app/apps/web/.output ./.output

EXPOSE 5678
CMD ["node", ".output/server/index.mjs"]
