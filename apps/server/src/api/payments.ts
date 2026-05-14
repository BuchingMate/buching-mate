import { Hono } from "hono";
import { isPaymentProvider } from "@workspace/contracts";
import { apiError } from "./errors";
import { isRecord, readJson } from "./validation";
import type { ApiEnv } from "./types";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import { logEvent } from "../observability/events";
import { enrichLogger, getLogger } from "../observability/request-context";
import {
  deletePaymentConnection,
  listPaymentConnections,
  listPaymentProviders,
} from "../services/payments";
import { upsertConnection } from "../services/payments/connections";
import { refundRegistration } from "../services/payments/refund";
import { createOAuthState, verifyOAuthState } from "../services/payments/state";
import { handleWebhook } from "../services/payments/webhook";
import { getAdapter, isAdapterAvailable } from "../payments/registry";

export const paymentRoutes = new Hono<ApiEnv>();

// Tier 1: public webhook (no auth — signature verification inside handler).
paymentRoutes.post("/webhooks/:provider", async (c) => {
  const provider = c.req.param("provider");
  enrichLogger({ provider, source: "webhook" });
  const rawBody = await c.req.text();
  const headers: Record<string, string | undefined> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const result = await handleWebhook({ provider, headers, rawBody });
  switch (result.type) {
    case "ok":
      logEvent("webhook.received", { provider, dedupe: false });
      return c.json({ received: true });
    case "duplicate":
      logEvent("webhook.received", { provider, dedupe: true });
      return c.json({ received: true, duplicate: true });
    case "ignored":
      return c.json({ received: true, ignored: true });
    case "invalid_signature":
      return apiError(c, 400, "invalid_signature", "Invalid webhook signature");
    case "unknown_provider":
      return apiError(c, 400, "unknown_provider", `Unknown provider: ${provider}`);
    case "provider_not_configured":
      return apiError(
        c,
        400,
        "provider_not_configured",
        `${provider} is not configured on this server`,
      );
  }
});

// Tier 2: OAuth callback (requireAuth only — browser redirect strips X-Org-Id).
paymentRoutes.get("/callback/:provider", requireAuth, async (c) => {
  const providerParam = c.req.param("provider");
  if (!isPaymentProvider(providerParam)) {
    return apiError(c, 400, "unknown_provider", `Unknown provider: ${providerParam}`);
  }
  if (!isAdapterAvailable(providerParam)) {
    return apiError(c, 400, "provider_not_configured", `${providerParam} is not configured`);
  }

  const code = c.req.query("code");
  const stateToken = c.req.query("state");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  if (error) {
    getLogger().warn({ error, errorDescription }, "oauth.callback.providerError");
    return apiError(c, 400, "oauth_failed", errorDescription ?? error);
  }
  if (!code || !stateToken) {
    return apiError(c, 400, "oauth_failed", "Missing code or state");
  }

  let state;
  try {
    state = verifyOAuthState(stateToken);
  } catch (err) {
    getLogger().warn({ err }, "oauth.callback.invalidState");
    return apiError(c, 400, "invalid_state", "Invalid or expired state");
  }
  if (state.userId !== c.var.user.id) {
    return apiError(c, 403, "state_user_mismatch", "Session user does not match state");
  }
  if (state.provider !== providerParam) {
    return apiError(c, 400, "state_provider_mismatch", "State provider does not match");
  }

  const adapter = getAdapter(state.provider);
  const redirectUri = buildCallbackUrl(c, state.provider);
  const exchanged = await adapter.exchangeOAuthCode({ code, redirectUri });

  const { connectionId } = await upsertConnection({
    orgId: state.orgId,
    provider: state.provider,
    exchanged,
  });

  logEvent("payment.connection.upserted", {
    provider: state.provider,
    orgId: state.orgId,
    connectionId,
  });

  const webBase = Bun.env.WEB_URL || "http://localhost:5678";
  const slug = c.req.query("slug") ?? "";
  const target = slug
    ? `${webBase}/admin/${slug}/settings?tab=payments&connected=${state.provider}`
    : `${webBase}/admin?connected=${state.provider}`;
  return c.redirect(target, 302);
});

function buildCallbackUrl(c: { req: { url: string } }, provider: string) {
  const url = new URL(c.req.url);
  return `${url.origin}/api/payments/callback/${provider}`;
}

// Tier 3: authenticated org routes.
paymentRoutes
  .use("*", requireAuth, requireOrg)
  .get("/providers", (c) => c.json(listPaymentProviders()))
  .get("/connections", async (c) =>
    c.json({ connections: await listPaymentConnections(c.var.orgId) }),
  )
  .post("/connect", requireRole("admin"), async (c) => {
    const body = (await readJson(c)) as Record<string, unknown> | null;
    if (!isRecord(body) || typeof body.provider !== "string") {
      return apiError(c, 400, "invalid_connect", "provider is required");
    }
    if (!isPaymentProvider(body.provider)) {
      return apiError(c, 400, "unknown_provider", `Unknown provider: ${body.provider}`);
    }
    if (!isAdapterAvailable(body.provider)) {
      return apiError(c, 400, "provider_not_configured", `${body.provider} is not configured`);
    }

    const adapter = getAdapter(body.provider);
    const stateToken = createOAuthState({
      orgId: c.var.orgId,
      userId: c.var.user.id,
      provider: body.provider,
    });
    const url = new URL(c.req.url);
    const redirectUri = `${url.origin}/api/payments/callback/${body.provider}`;
    const onboardingUrl = adapter.buildOnboardingUrl({ state: stateToken, redirectUri });
    return c.json({ url: onboardingUrl });
  })
  .delete("/connections/:connectionId", requireRole("admin"), async (c) => {
    const deleted = await deletePaymentConnection(c.var.orgId, c.req.param("connectionId"));
    if (!deleted)
      return apiError(c, 404, "payment_connection_not_found", "Payment connection not found");
    return c.json({ deleted: true });
  })
  .post("/registrations/:registrationId/refund", requireRole("admin"), async (c) => {
    const body = (await readJson(c)) as Record<string, unknown> | null;
    let amount: number | undefined;
    let reason: string | undefined;
    if (isRecord(body)) {
      if (body.amount !== undefined) {
        if (typeof body.amount !== "number" || !Number.isInteger(body.amount) || body.amount < 0) {
          return apiError(c, 400, "invalid_amount", "amount must be a non-negative integer");
        }
        amount = body.amount;
      }
      if (typeof body.reason === "string") reason = body.reason;
    }

    const result = await refundRegistration({
      orgId: c.var.orgId,
      registrationId: c.req.param("registrationId"),
      requestedByUserId: c.var.user.id,
      amount,
      reason,
    });
    if (result.type === "error") {
      const status =
        result.code === "registration_not_found"
          ? 404
          : result.code === "not_paid"
            ? 409
            : result.code === "adapter_failed"
              ? 502
              : 400;
      return apiError(c, status, result.code, result.message);
    }
    return c.json({ refundId: result.refundId, refundStatus: result.refundStatus });
  });
