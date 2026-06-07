import { Hono } from "hono";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import { logEvent } from "../observability/events";
import { WEB_URL } from "../env";
import { enrichLogger, getLogger } from "../observability/request-context";
import { VideoInvalidSignatureError, type VideoProvider } from "../video/adapter";
import {
  getVideoAdapter,
  isVideoProviderAvailable,
  listAvailableVideoProviders,
} from "../video/registry";
import { issueOAuthState, verifyOAuthState } from "../video/oauth-state";
import {
  disconnectZoom,
  dropEventVideoByMeetingId,
  fetchAttendanceForMeetingUuid,
  getHostStartUrl,
  getZoomConnection,
  listAttendance,
  markZoomRevokedByZoomUser,
  upsertZoomConnection,
} from "../services/video";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { webhookEvents } from "../db/schema";
import { organization } from "../db/auth-schema";

const ZOOM: VideoProvider = "zoom";

function buildCallbackUrl(c: { req: { url: string } }, provider: VideoProvider) {
  const url = new URL(c.req.url);
  return `${url.origin}/api/video/callback/${provider}`;
}

function isVideoProvider(value: string): value is VideoProvider {
  return value === ZOOM;
}

export const videoRoutes = new Hono<ApiEnv>();

// Webhook (no auth — signature verified inside adapter).
videoRoutes.post("/webhooks/:provider", async (c) => {
  const provider = c.req.param("provider");
  enrichLogger({ provider, source: "video.webhook" });

  if (!isVideoProvider(provider)) {
    return apiError(c, 400, "unknown_provider", `Unknown provider: ${provider}`);
  }
  if (!isVideoProviderAvailable(provider)) {
    return apiError(c, 400, "provider_not_configured", `${provider} is not configured`);
  }

  const rawBody = await c.req.text();
  const headers: Record<string, string | undefined> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const adapter = getVideoAdapter(provider);
  let event;
  try {
    event = await adapter.verifyAndParseWebhook(headers, rawBody);
  } catch (err) {
    if (err instanceof VideoInvalidSignatureError) {
      getLogger().warn({ err: err.message }, "video.webhook.invalidSignature");
      return apiError(c, 400, "invalid_signature", "Invalid webhook signature");
    }
    throw err;
  }
  if (!event) return c.json({ received: true, ignored: true });

  if (event.type === "endpoint.url_validation") {
    return c.json(adapter.computeUrlValidationResponse(event.plainToken));
  }

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider,
      providerEventId: event.providerEventId,
      payload: { type: event.type } as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    logEvent("video.webhook.duplicate", { provider, type: event.type });
    return c.json({ received: true, duplicate: true });
  }

  if (event.type === "app.deauthorized") {
    await markZoomRevokedByZoomUser(event.userId);
    logEvent("video.deauthorized", { provider, zoomUserId: event.userId });
    return c.json({ received: true });
  }
  if (event.type === "meeting.ended") {
    logEvent("video.meeting.ended", {
      provider,
      meetingId: event.meetingId,
      meetingUuid: event.meetingUuid,
    });
    void fetchAttendanceForMeetingUuid(event.meetingUuid).catch((err: unknown) => {
      getLogger().warn({ err, meetingUuid: event.meetingUuid }, "video.attendance.fetchFailed");
    });
    return c.json({ received: true });
  }
  if (event.type === "meeting.deleted") {
    logEvent("video.meeting.deleted", {
      provider,
      meetingId: event.meetingId,
    });
    await dropEventVideoByMeetingId(event.meetingId);
    return c.json({ received: true });
  }
  return c.json({ received: true });
});

// OAuth callback (requireAuth — browser redirect cannot include X-Org-Id).
videoRoutes.get("/callback/:provider", requireAuth, async (c) => {
  const providerParam = c.req.param("provider");
  if (!isVideoProvider(providerParam)) {
    return apiError(c, 400, "unknown_provider", `Unknown provider: ${providerParam}`);
  }
  if (!isVideoProviderAvailable(providerParam)) {
    return apiError(c, 400, "provider_not_configured", `${providerParam} is not configured`);
  }

  const code = c.req.query("code");
  const stateToken = c.req.query("state");
  const oauthError = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  if (oauthError) {
    getLogger().warn({ error: oauthError, errorDescription }, "video.oauth.providerError");
    return apiError(c, 400, "oauth_failed", errorDescription ?? oauthError);
  }
  if (!code || !stateToken) {
    return apiError(c, 400, "oauth_failed", "Missing code or state");
  }

  let state;
  try {
    state = verifyOAuthState(stateToken);
  } catch (err) {
    getLogger().warn({ err }, "video.oauth.invalidState");
    return apiError(c, 400, "invalid_state", "Invalid or expired state");
  }
  if (state.userId !== c.var.user.id) {
    return apiError(c, 403, "state_user_mismatch", "Session user does not match state");
  }

  const adapter = getVideoAdapter(providerParam);
  const redirectUri = buildCallbackUrl(c, providerParam);
  const tokens = await adapter.exchangeOAuthCode({ code, redirectUri });
  await upsertZoomConnection(state.orgId, tokens);

  logEvent("video.connection.upserted", { provider: providerParam, orgId: state.orgId });

  // Send the tab back to the org's settings page; ?connected=zoom shows the
  // success banner and refetches the connection status.
  const [org] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, state.orgId))
    .limit(1);
  const target = org?.slug
    ? `${WEB_URL}/admin/${org.slug}/settings?tab=integrations&connected=${providerParam}`
    : `${WEB_URL}/admin?connected=${providerParam}`;
  return c.redirect(target, 302);
});

// Authenticated org routes.
videoRoutes
  .use("*", requireAuth, requireOrg)
  .get("/providers", (c) => c.json({ providers: listAvailableVideoProviders() }))
  .get("/connections/zoom", async (c) => {
    const connection = await getZoomConnection(c.var.orgId);
    return c.json({ connection });
  })
  .post("/connect/zoom", requireRole("owner"), async (c) => {
    if (!isVideoProviderAvailable(ZOOM)) {
      return apiError(c, 400, "provider_not_configured", "Zoom is not configured");
    }
    const adapter = getVideoAdapter(ZOOM);
    const stateToken = issueOAuthState(c.var.orgId, c.var.user.id);
    const redirectUri = buildCallbackUrl(c, ZOOM);
    const url = adapter.buildOnboardingUrl({ state: stateToken, redirectUri });
    return c.json({ url });
  })
  .delete("/connections/zoom", requireRole("owner"), async (c) => {
    const deleted = await disconnectZoom(c.var.orgId);
    if (!deleted) return apiError(c, 404, "video_connection_not_found", "Not connected");
    return c.json({ deleted: true });
  })
  .get("/events/:eventId/attendance", requireRole("manager"), async (c) => {
    const rows = await listAttendance(c.var.orgId, c.req.param("eventId"));
    return c.json({ attendance: rows });
  })
  .get("/events/:eventId/host-start-url", requireRole("manager"), async (c) => {
    const url = await getHostStartUrl(c.var.orgId, c.req.param("eventId"));
    if (!url) return apiError(c, 404, "host_start_url_not_found", "No host start URL");
    return c.json({ url });
  });
