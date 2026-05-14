import { queryOptions } from "@tanstack/react-query";
import { listPaymentConnections, listPaymentProviders } from "@/lib/payments";

export const paymentsKeys = {
  all: ["payments"] as const,
  providers: () => [...paymentsKeys.all, "providers"] as const,
  connections: () => [...paymentsKeys.all, "connections"] as const,
};

export const paymentProvidersQueryOptions = queryOptions({
  queryKey: paymentsKeys.providers(),
  queryFn: () => listPaymentProviders(),
});

export const paymentConnectionsQueryOptions = queryOptions({
  queryKey: paymentsKeys.connections(),
  queryFn: () => listPaymentConnections(),
});
