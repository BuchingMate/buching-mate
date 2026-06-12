import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { BUSINESS_SLUG } from "./branding";
import { observability } from "./middleware/observability";
import { rateLimit } from "./middleware/rate-limit";
import type { HealthResponse, RootResponse } from "@workspace/contracts";
import { accountRoutes } from "./api/account";
import { assetRoutes } from "./api/assets";
import { attendeeRoutes } from "./api/attendees";
import { billingRoutes } from "./api/billing";
import { broadcastRoutes } from "./api/broadcasts";
import { eventRoutes } from "./api/events";
import { geoRoutes } from "./api/geo";
import { orgRoutes } from "./api/org";
import { paymentRoutes } from "./api/payments";
import { publicRoutes } from "./api/public";
import { registrationRoutes } from "./api/registrations";
import { resourceRoutes } from "./api/resources";
import { videoRoutes } from "./api/video";
import { webhookRoutes } from "./api/webhooks";
import { resendWebhookRoutes } from "./api/webhooks/resend";
import { PUBLIC_HOST_SUFFIXES, WEB_URL } from "./env";
import { ensureFreshDomainCache, lookupCustomDomainHost } from "./services/domains/cache";

const webOrigin = WEB_URL;
const allowlist = PUBLIC_HOST_SUFFIXES;

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
  // Active customer domains book cross-origin against this API.
  if (lookupCustomDomainHost(host)) return origin;
  return null;
}

export function createApp() {
  const app = new Hono();

  app.use("*", observability);

  // Keep the custom-domain host map warm so the (sync) CORS origin callback can
  // consult it. No-op within the cache TTL. A failed refresh must not take down
  // unrelated requests — stale (or empty) data only narrows CORS.
  app.use("*", async (_c, next) => {
    try {
      await ensureFreshDomainCache();
    } catch {
      // served from the previous snapshot
    }
    await next();
  });

  app.use(
    "*",
    cors({
      origin: resolveOrigin,
      allowHeaders: ["Content-Type", "Authorization", "X-Org-Id", "X-Captcha-Response"],
      allowMethods: ["POST", "GET", "PATCH", "PUT", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.get("/", (c) => c.json<RootResponse>({ ok: true, service: `${BUSINESS_SLUG}-server` }));
  app.get("/health", (c) => c.json<HealthResponse>({ status: "ok" }));

  // Throttle the resend-verification endpoint per source IP — without this,
  // anyone with a valid email can mass-trigger verification mails. Capacity 3
  // tokens, refill 1 every 5 minutes.
  app.use(
    "/api/auth/send-verification-email",
    rateLimit({
      key: (c) =>
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("host") ?? "unknown",
      capacity: 3,
      refillPerSec: 1 / 300,
      errorCode: "RESEND_VERIFICATION_RATE_LIMITED",
      errorMessage: "Too many verification emails requested — try again later",
    }),
  );

  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.route("/api/org", orgRoutes);
  app.route("/api/account", accountRoutes);
  app.route("/api/assets", assetRoutes);
  app.route("/api/resources", resourceRoutes);
  app.route("/api/events", eventRoutes);
  app.route("/api/geo", geoRoutes);
  app.route("/api/broadcasts", broadcastRoutes);
  app.route("/api/attendees", attendeeRoutes);
  app.route("/api/registrations", registrationRoutes);
  app.route("/api/payments", paymentRoutes);
  app.route("/api/billing", billingRoutes);
  app.route("/api/video", videoRoutes);
  app.route("/api/webhooks/resend", resendWebhookRoutes);
  app.route("/api/webhooks", webhookRoutes);
  app.route("/api/public", publicRoutes);

  return app;
}

export const app = createApp();
