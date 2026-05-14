import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicAssetUpload } from "@/components/public-asset-upload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clearOrgLogo } from "@/lib/assets";
import { updateOrgSettings } from "@/lib/org";
import { getOrgPublicUrl } from "@/lib/public";
import { currentOrgQueryOptions } from "@/queries/auth";
import { orgKeys, orgSettingsQueryOptions } from "@/queries/org";

export function GeneralTab({ orgSlug }: { orgSlug: string }) {
  const orgQuery = useQuery(currentOrgQueryOptions);
  const settingsQuery = useQuery(orgSettingsQueryOptions);
  const queryClient = useQueryClient();

  const [contactEmail, setContactEmail] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const publicBookingUrl = getOrgPublicUrl(orgSlug);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setContactEmail(settingsQuery.data.settings.contactEmail ?? "");
    setCurrency(settingsQuery.data.settings.currency);
  }, [settingsQuery.data]);

  useEffect(() => {
    setLogoUrl(orgQuery.data?.org.logo ?? null);
  }, [orgQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: { contactEmail: string | null; currency: string }) =>
      updateOrgSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.settings() });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Couldn't save settings. Try again."),
  });

  const clearLogoMutation = useMutation({
    mutationFn: clearOrgLogo,
    onSuccess: async () => {
      setLogoUrl(null);
      await queryClient.invalidateQueries({ queryKey: currentOrgQueryOptions.queryKey });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Couldn't remove logo. Try again."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate({
      contactEmail: contactEmail.trim() || null,
      currency,
    });
  };

  const copyPublicUrl = async () => {
    await navigator.clipboard.writeText(publicBookingUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const updateLogo = (url: string | null) => {
    if (url) {
      setLogoUrl(url);
      void queryClient.invalidateQueries({ queryKey: currentOrgQueryOptions.queryKey });
      return;
    }

    clearLogoMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization details</CardTitle>
        <CardDescription>
          Name and slug are immutable. Update contact and currency below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <p className="text-sm text-muted-foreground">{orgQuery.data?.org.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <p className="text-sm text-muted-foreground">{orgSlug}</p>
            </div>
          </div>

          <PublicAssetUpload
            label="Logo"
            kind="org_logo"
            value={logoUrl}
            disabled={clearLogoMutation.isPending}
            onChange={updateLogo}
            onError={setError}
          />

          <div className="space-y-2">
            <Label>Public booking URL</Label>
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <a
                  href={publicBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {publicBookingUrl}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  Published events appear on this public booking page.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyPublicUrl}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="hello@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={(value) => value && setCurrency(value)}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="AUD">AUD</SelectItem>
              </SelectContent>
            </Select>
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
