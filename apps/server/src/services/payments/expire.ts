import { and, eq, lt } from "drizzle-orm";
import { db } from "../../db";
import { registrations } from "../../db/schema";

/**
 * Lazily expire any pending paid registrations whose checkout TTL has elapsed.
 * Called from registration list/detail loaders so capacity reflects truth without a cron job.
 */
export async function expireStalePendingPayments(orgId: string, eventId?: string): Promise<void> {
  const conditions = [
    eq(registrations.orgId, orgId),
    eq(registrations.paymentStatus, "pending"),
    lt(registrations.paymentExpiresAt, new Date()),
  ];
  if (eventId) {
    conditions.push(eq(registrations.eventId, eventId));
  }

  await db
    .update(registrations)
    .set({ paymentStatus: "expired", status: "cancelled", updatedAt: new Date() })
    .where(and(...conditions));
}
