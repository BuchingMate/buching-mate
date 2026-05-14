import "./observability/otel";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { BUSINESS_SLUG } from "./branding";
import { observability } from "./middleware/observability";
import { logger } from "./observability/logger";
import type { HealthResponse, RootResponse } from "@workspace/contracts";
import { assetRoutes } from "./api/assets";
import { attendeeRoutes } from "./api/attendees";
import { eventRoutes } from "./api/events";
import { orgRoutes } from "./api/org";
import { paymentRoutes } from "./api/payments";
import { publicRoutes } from "./api/public";
import { registrationRoutes } from "./api/registrations";
import { resourceRoutes } from "./api/resources";
import { webhookRoutes } from "./api/webhooks";

const app = new Hono();
const webOrigin = Bun.env.WEB_URL || "http://localhost:5678";
const allowlist = (Bun.env.PUBLIC_HOST_ALLOWLIST || ".lvh.me,.localhost,localhost")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function resolveOrigin(origin: string) {
  if (origin === webOrigin) return origin;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return null;
  }
  for (const entry of allowlist) {
    if (entry.startsWith(".")) {
      if (host.endsWith(entry) || host === entry.slice(1)) return origin;
    } else if (host === entry) {
      return origin;
    }
  }
  return null;
}

app.use("*", observability);

app.use(
  "*",
  cors({
    origin: resolveOrigin,
    allowHeaders: ["Content-Type", "Authorization", "X-Org-Id"],
    allowMethods: ["POST", "GET", "PATCH", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.get("/", (c) => c.json<RootResponse>({ ok: true, service: `${BUSINESS_SLUG}-server` }));

app.get("/health", (c) => c.json<HealthResponse>({ status: "ok" }));

// Mount Better Auth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/org", orgRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/resources", resourceRoutes);
app.route("/api/events", eventRoutes);
app.route("/api/attendees", attendeeRoutes);
app.route("/api/registrations", registrationRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api/public", publicRoutes);

const port = Number(Bun.env.SERVER_PORT ?? 3456);

Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info({ port }, "server started");
