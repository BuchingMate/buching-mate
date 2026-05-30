import { queryOptions } from "@tanstack/react-query";
import { getBillingHistory, getPlanPricing, getSubscriptionInfo } from "@/lib/billing";

export const billingKeys = {
  all: ["billing"] as const,
  subscription: () => [...billingKeys.all, "subscription"] as const,
  pricing: () => [...billingKeys.all, "pricing"] as const,
  history: () => [...billingKeys.all, "history"] as const,
};

export const subscriptionInfoQueryOptions = queryOptions({
  queryKey: billingKeys.subscription(),
  queryFn: getSubscriptionInfo,
});

export const planPricingQueryOptions = queryOptions({
  queryKey: billingKeys.pricing(),
  queryFn: getPlanPricing,
  staleTime: 60 * 60 * 1000,
});

export const billingHistoryQueryOptions = queryOptions({
  queryKey: billingKeys.history(),
  queryFn: getBillingHistory,
});
