import { Hono } from "hono";
import { and, eq, gte, sql } from "drizzle-orm";
import { Webhook } from "svix";
import { db } from "../../db";
import { emailEvent, orgSettings } from "../../db/schema";
import { getLogger } from "../../observability/request-context";

// Resend webhook events we listen for. `email.sent` is needed as the
// denominator for the complaint-rate rule below.
type ResendEventType =
  | "email.sent"
  | "email.bounced"
  | "email.complained"
  | "email.delivery_delayed";

interface ResendTag {
  name: string;
  value: string;
}

interface ResendWebhookPayload {
  type: ResendEventType;
  data: {
    email_id: string;
    to: string | string[];
    tags?: ResendTag[];
  };
}

// Auto-suspend rule: industry-rough complaint threshold with a volume floor so
// the first 1 complaint on a brand-new org doesn't read as 100%.
const COMPLAINT_RATE_THRESHOLD = 0.01;
const MIN_SENDS_FOR_SUSPENSION = 20;
const ROLLING_WINDOW_HOURS = 24;

export const resendWebhookRoutes = new Hono().post("/", async (c) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "not configured" }, 503);

  const rawBody = await c.req.text();
  const svixId = c.req.header("svix-id") ?? "";
  const svixTimestamp = c.req.header("svix-timestamp") ?? "";
  const svixSignature = c.req.header("svix-signature") ?? "";

  let payload: ResendWebhookPayload;
  try {
    payload = new Webhook(secret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch (err) {
    getLogger().warn({ err }, "resend webhook signature verify failed");
    return c.json({ error: "invalid signature" }, 401);
  }

  const tags = payload.data.tags ?? [];
  const orgId = tags.find((t) => t.name === "org_id")?.value ?? null;
  const kind = tags.find((t) => t.name === "kind")?.value ?? null;
  const toEmail = Array.isArray(payload.data.to) ? (payload.data.to[0] ?? "") : payload.data.to;

  // Idempotent on (resend_email_id, event_type). Replay of the same event from
  // the Resend dashboard is a no-op.
  await db
    .insert(emailEvent)
    .values({
      orgId,
      resendEmailId: payload.data.email_id,
      eventType: payload.type,
      kind,
      toEmail,
      payload: payload as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing();

  if (orgId && payload.type === "email.complained") {
    await maybeSuspendOrg(orgId);
  }

  return c.json({ ok: true });
});

// Recompute the rolling 24h complaint rate for one org. Flip
// org_settings.sending_suspended when the rate exceeds threshold and the org
// has cleared the volume floor. Operator unflips manually via Drizzle Studio.
async function maybeSuspendOrg(orgId: string): Promise<void> {
  const since = new Date(Date.now() - ROLLING_WINDOW_HOURS * 60 * 60 * 1000);

  const rows = await db
    .select({
      eventType: emailEvent.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(emailEvent)
    .where(and(eq(emailEvent.orgId, orgId), gte(emailEvent.receivedAt, since)))
    .groupBy(emailEvent.eventType);

  const sends = rows.find((r) => r.eventType === "email.sent")?.count ?? 0;
  const complaints = rows.find((r) => r.eventType === "email.complained")?.count ?? 0;

  if (sends < MIN_SENDS_FOR_SUSPENSION) return;
  if (complaints / sends <= COMPLAINT_RATE_THRESHOLD) return;

  await db
    .insert(orgSettings)
    .values({ orgId, sendingSuspended: true })
    .onConflictDoUpdate({
      target: orgSettings.orgId,
      set: { sendingSuspended: true },
    });

  getLogger().warn(
    { orgId, sends, complaints, rate: complaints / sends },
    "org sending auto-suspended: complaint rate exceeded threshold",
  );
}
