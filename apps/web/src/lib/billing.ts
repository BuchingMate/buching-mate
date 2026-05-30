import type {
  BillingHistoryItem,
  PlanPricingResponse,
  SubscriptionInfo,
} from "@workspace/contracts";
import { api } from "./api";

// Owner-only: returns a Polar customer-portal URL (manage seats, payment method,
// cancel). Goes through our server so it can scope the session to the billing member
// — the plugin's client-side customer.portal() 500s for team (seat-based) customers.
export function getBillingPortalUrl() {
  return api.get<{ url: string }>("/api/billing/portal");
}

// Current subscription summary (plan, interval, renewal).
export function getSubscriptionInfo() {
  return api.get<SubscriptionInfo>("/api/billing/subscription");
}

// Live Team plan pricing (monthly + annual), cached on the server.
export function getPlanPricing() {
  return api.get<PlanPricingResponse>("/api/billing/pricing");
}

// Past charges for the org, newest first.
export function getBillingHistory() {
  return api.get<{ items: BillingHistoryItem[] }>("/api/billing/history");
}

// Invoice download for one order. Resolves to a URL when ready, or null when the
// invoice is still generating (the caller should ask the user to retry).
export async function getInvoiceUrl(orderId: string): Promise<string | null> {
  const res = await api.get<{ url?: string; status?: string }>(`/api/billing/invoice/${orderId}`);
  return res.url ?? null;
}
