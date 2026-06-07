import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { disconnectZoom, startZoomConnect } from "@/lib/video";
import { videoKeys, videoProvidersQueryOptions, zoomConnectionQueryOptions } from "@/queries/video";

export function VideoTab() {
  const providersQuery = useQuery(videoProvidersQueryOptions);
  const connectionQuery = useQuery(zoomConnectionQueryOptions);
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { connected?: string };

  useEffect(() => {
    if (search.connected === "zoom") {
      queryClient.invalidateQueries({ queryKey: videoKeys.zoomConnection() });
    }
  }, [search.connected, queryClient]);

  const connectMutation = useMutation({
    mutationFn: () => startZoomConnect(),
    onSuccess: (data) => {
      // New tab keeps the settings page open; fall back to same-tab if blocked.
      const popup = window.open(data.url, "_blank");
      if (!popup) window.location.assign(data.url);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectZoom(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.zoomConnection() });
    },
  });

  const enabled = providersQuery.data?.providers.includes("zoom") ?? false;
  const connection = connectionQuery.data?.connection ?? null;
  const pending = connectMutation.isPending || disconnectMutation.isPending;

  return (
    <div className="space-y-4">
      {search.connected === "zoom" ? (
        <Alert>
          <AlertDescription>
            Zoom connected. Published events will auto-create a meeting.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Connected applications</CardTitle>
          <CardDescription>
            Link third-party tools that power your events. Connect Zoom so published events get a
            meeting link automatically; attendees see the join link after registration is confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Zoom</span>
                {!enabled ? (
                  <Badge variant="outline" className="text-xs">
                    Server not configured
                  </Badge>
                ) : connection ? (
                  <Badge
                    variant={
                      connection.status === "active"
                        ? "success"
                        : connection.status === "error"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-xs"
                  >
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
                  {connection.email ?? connection.accountId}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? "Connect to start the OAuth flow."
                    : "Set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_REDIRECT_URI on the server to enable."}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {connection ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={pending}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  disabled={!enabled || pending}
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
          {connection?.status === "error" && connection.lastError ? (
            <Alert variant="destructive">
              <AlertTitle>Zoom sync failed</AlertTitle>
              <AlertDescription>
                {connection.lastError}
                {connection.lastErrorAt
                  ? ` (last ${new Date(connection.lastErrorAt).toLocaleString()})`
                  : ""}
                . Reconnect Zoom to fix.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
