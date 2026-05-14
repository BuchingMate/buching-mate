import { Hono } from "hono";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import {
  getWebhookDelivery,
  listWebhookDeliveries,
  markWebhookRetry,
  regenerateWebhookSecret,
} from "../services/webhooks";

export const webhookRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .get("/", requireRole("admin"), async (c) =>
    c.json({ deliveries: await listWebhookDeliveries(c.var.orgId) }),
  )
  .get("/:deliveryId", requireRole("admin"), async (c) => {
    const delivery = await getWebhookDelivery(c.var.orgId, c.req.param("deliveryId"));
    if (!delivery)
      return apiError(c, 404, "webhook_delivery_not_found", "Webhook delivery not found");
    return c.json({ delivery });
  })
  .post("/:deliveryId/retry", requireRole("admin"), async (c) => {
    const delivery = await markWebhookRetry(c.var.orgId, c.req.param("deliveryId"));
    if (!delivery)
      return apiError(c, 404, "webhook_delivery_not_found", "Webhook delivery not found");
    return c.json({ delivery });
  })
  .post("/secret/regenerate", requireRole("admin"), async (c) => {
    const webhookSecret = await regenerateWebhookSecret(c.var.orgId);
    if (!webhookSecret)
      return apiError(c, 404, "org_settings_not_found", "Organization settings not found");
    return c.json({ webhookSecret });
  });
