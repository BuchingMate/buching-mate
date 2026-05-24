import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { subscriptionUsage } from "../db/schema";

export type UsageMetric = "events_created" | "broadcast_sends";

export function monthStart(when: Date = new Date()): Date {
  const d = new Date(when);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Start of the UTC week (Monday 00:00) for the given date. Broadcast quota is
// counted per week, matching how the plans frame send limits.
export function weekStart(when: Date = new Date()): Date {
  const d = new Date(when);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday
  const mondayOffset = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export async function incrementUsage(
  executor: Executor,
  orgId: string,
  metric: UsageMetric,
  periodStart: Date = monthStart(),
  delta = 1,
): Promise<void> {
  await executor
    .insert(subscriptionUsage)
    .values({ orgId, metric, periodStart, count: delta })
    .onConflictDoUpdate({
      target: [subscriptionUsage.orgId, subscriptionUsage.metric, subscriptionUsage.periodStart],
      set: {
        count: sql`${subscriptionUsage.count} + ${delta}`,
        updatedAt: new Date(),
      },
    });
}

export async function getUsage(
  orgId: string,
  metric: UsageMetric,
  periodStart: Date = monthStart(),
): Promise<number> {
  const rows = await db
    .select({ count: subscriptionUsage.count })
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.orgId, orgId),
        eq(subscriptionUsage.metric, metric),
        eq(subscriptionUsage.periodStart, periodStart),
      ),
    )
    .limit(1);
  return rows[0]?.count ?? 0;
}
