import type { PaymentConnectionDto, PaymentProvider } from "@workspace/contracts";
import { api } from "./api";

export type ListProvidersResponse = {
  providers: Array<{ id: PaymentProvider; name: string; enabled: boolean }>;
};

export type ListConnectionsResponse = {
  connections: PaymentConnectionDto[];
};

export type ConnectResponse = { url: string };
export type RefundResponse = { refundId: string; refundStatus: string };

export function listPaymentProviders() {
  return api.get<ListProvidersResponse>("/api/payments/providers");
}

export function listPaymentConnections() {
  return api.get<ListConnectionsResponse>("/api/payments/connections");
}

export function startPaymentConnect(provider: PaymentProvider) {
  return api.post<ConnectResponse>("/api/payments/connect", { provider });
}

export function disconnectPaymentConnection(connectionId: string) {
  return api.delete<{ deleted: boolean }>(`/api/payments/connections/${connectionId}`);
}

export function refundRegistration(input: {
  registrationId: string;
  amount?: number;
  reason?: string;
}) {
  const { registrationId, ...body } = input;
  return api.post<RefundResponse>(`/api/payments/registrations/${registrationId}/refund`, body);
}
