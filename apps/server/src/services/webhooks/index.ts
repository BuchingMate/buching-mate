import type { WebhookDeliveryDto } from "@workspace/contracts";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { orgSettings, webhookDeliveries } from "../../db/schema";

function toWebhookDeliveryDto(delivery: typeof webhookDeliveries.$inferSelect): WebhookDeliveryDto {
  return {
    id: delivery.id,
    orgId: delivery.orgId,
    eventType: delivery.eventType,
    payload: delivery.payload,
    status: delivery.status,
    attempts: delivery.attempts,
    maxAttempts: delivery.maxAttempts,
    lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
    lastError: delivery.lastError,
    responseStatus: delivery.responseStatus,
    durationMs: delivery.durationMs,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
    updatedAt: delivery.updatedAt.toISOString(),
  };
}

export async function listWebhookDeliveries(orgId: string): Promise<WebhookDeliveryDto[]> {
  const rows = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.orgId, orgId));
  return rows.map(toWebhookDeliveryDto);
}

export async function getWebhookDelivery(
  orgId: string,
  deliveryId: string,
): Promise<WebhookDeliveryDto | null> {
  const rows = await db
    .select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.orgId, orgId), eq(webhookDeliveries.id, deliveryId)))
    .limit(1);

  return rows[0] ? toWebhookDeliveryDto(rows[0]) : null;
}

export async function markWebhookRetry(
  orgId: string,
  deliveryId: string,
): Promise<WebhookDeliveryDto | null> {
  const rows = await db
    .update(webhookDeliveries)
    .set({ status: "pending", lastError: null, updatedAt: new Date() })
    .where(and(eq(webhookDeliveries.orgId, orgId), eq(webhookDeliveries.id, deliveryId)))
    .returning();

  return rows[0] ? toWebhookDeliveryDto(rows[0]) : null;
}

export async function regenerateWebhookSecret(orgId: string) {
  const secret = crypto.randomUUID();
  const rows = await db
    .update(orgSettings)
    .set({ webhookSecret: secret, updatedAt: new Date() })
    .where(eq(orgSettings.orgId, orgId))
    .returning({ webhookSecret: orgSettings.webhookSecret });

  return rows[0]?.webhookSecret ?? null;
}
