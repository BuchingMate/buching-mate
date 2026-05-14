import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrgSettings } from "@/lib/org";
import { orgKeys, orgSettingsQueryOptions } from "@/queries/org";
import { BUSINESS_SLUG } from "@/lib/branding";

export function WebhooksTab() {
  const settingsQuery = useQuery(orgSettingsQueryOptions);
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setWebhookUrl(settingsQuery.data.settings.webhookUrl ?? "");
  }, [settingsQuery.data]);

  const secret = settingsQuery.data?.settings.webhookSecret ?? null;

  const mutation = useMutation({
    mutationFn: (input: { webhookUrl: string | null }) => updateOrgSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.settings() });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Couldn't save webhook. Try again."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate({ webhookUrl: webhookUrl.trim() || null });
  };

  const copy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          Receive event notifications at your endpoint. Sign payloads with the shared secret.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={`https://example.com/webhooks/${BUSINESS_SLUG}`}
            />
          </div>

          <div className="space-y-2">
            <Label>Signing secret</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={secret ? "•".repeat(32) : "—"} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copy}
                disabled={!secret}
                aria-label="Copy webhook secret"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Provisioned automatically. Read-only.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
