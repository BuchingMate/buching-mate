import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import type { PaymentConnectionDto, PaymentProvider } from "@workspace/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { disconnectPaymentConnection, startPaymentConnect } from "@/lib/payments";
import {
  paymentConnectionsQueryOptions,
  paymentProvidersQueryOptions,
  paymentsKeys,
} from "@/queries/payments";
import { BUSINESS_NAME } from "@/lib/branding";

export function PaymentsTab() {
  const providersQuery = useQuery(paymentProvidersQueryOptions);
  const connectionsQuery = useQuery(paymentConnectionsQueryOptions);
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { connected?: string; tab?: string };

  useEffect(() => {
    if (search.connected) {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.connections() });
    }
  }, [search.connected, queryClient]);

  const connectMutation = useMutation({
    mutationFn: (provider: PaymentProvider) => startPaymentConnect(provider),
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) => disconnectPaymentConnection(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsKeys.connections() });
    },
  });

  const providers = providersQuery.data?.providers ?? [];
  const connections = connectionsQuery.data?.connections ?? [];

  return (
    <div className="space-y-4">
      {search.connected ? (
        <Alert>
          <AlertDescription>
            Connected {search.connected}. Webhook + checkout will route through this account.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payment providers</CardTitle>
          <CardDescription>
            Connect your provider account to accept paid bookings. Customers pay you directly;
            {BUSINESS_NAME} forwards the checkout via Connect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.map((p) => {
            const connection = connections.find((c) => c.provider === p.id);
            return (
              <ProviderRow
                key={p.id}
                providerId={p.id}
                providerName={p.name}
                enabled={p.enabled}
                connection={connection}
                onConnect={() => connectMutation.mutate(p.id)}
                onDisconnect={
                  connection ? () => disconnectMutation.mutate(connection.id) : undefined
                }
                pending={connectMutation.isPending || disconnectMutation.isPending}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderRow({
  providerId,
  providerName,
  enabled,
  connection,
  onConnect,
  onDisconnect,
  pending,
}: {
  providerId: PaymentProvider;
  providerName: string;
  enabled: boolean;
  connection: PaymentConnectionDto | undefined;
  onConnect: () => void;
  onDisconnect?: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{providerName}</span>
          {!enabled ? (
            <Badge variant="outline" className="text-xs">
              Server not configured
            </Badge>
          ) : connection ? (
            <Badge variant="success" className="text-xs">
              {connection.status}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Not connected
            </Badge>
          )}
        </div>
        {connection ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {connection.accountId} · {(connection as { currency?: string }).currency ?? ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "Click connect to start the OAuth flow."
              : `Set ${providerId.toUpperCase()}_* env vars on the server to enable.`}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {connection ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            disabled={!onDisconnect || pending}
          >
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={onConnect} disabled={!enabled || pending}>
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
