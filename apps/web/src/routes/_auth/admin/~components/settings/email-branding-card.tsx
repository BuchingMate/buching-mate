import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EMPTY_EMAIL_BRANDING,
  renderBroadcastEmail,
  type EmailBranding,
} from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrgSettings } from "@/lib/org";
import { currentOrgQueryOptions } from "@/queries/auth";
import { orgKeys, orgSettingsQueryOptions } from "@/queries/org";
import { EmailPreviewFrame } from "../email-preview-frame";

const SAMPLE_BODY =
  '<p>Hi there,</p><p>This is how your newsletters and invitations will look. Edit the brand once here and it applies to every send.</p><p><a href="#">A sample link →</a></p>';

export function EmailBrandingCard() {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(currentOrgQueryOptions);
  const settingsQuery = useQuery(orgSettingsQueryOptions);
  const orgName = orgQuery.data?.org.name ?? "Your organization";
  const saved = settingsQuery.data?.settings.emailBranding;

  const [branding, setBranding] = useState<EmailBranding>(EMPTY_EMAIL_BRANDING);
  useEffect(() => {
    if (saved) setBranding(saved);
  }, [saved]);

  const previewHtml = useMemo(
    () =>
      renderBroadcastEmail({
        subject: "Spring term is open",
        bodyHtml: SAMPLE_BODY,
        orgName,
        branding,
      }),
    [orgName, branding],
  );

  const mutation = useMutation({
    mutationFn: () => updateOrgSettings({ emailBranding: branding }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.settings() }),
  });

  const dirty = JSON.stringify(branding) !== JSON.stringify(saved ?? EMPTY_EMAIL_BRANDING);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand template</CardTitle>
        <CardDescription>
          The look applied to every newsletter and invitation you send. Set it once for the whole
          organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand-accent" className="text-muted-foreground">
                  Accent
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="brand-accent"
                    type="color"
                    value={branding.accentColor ?? "#1f2430"}
                    onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                    className="size-9 cursor-pointer rounded-md border border-border bg-transparent p-1"
                    aria-label="Accent color"
                  />
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {branding.accentColor ?? "default"}
                  </span>
                </div>
              </div>
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="brand-logo" className="text-muted-foreground">
                  Logo URL
                </Label>
                <Input
                  id="brand-logo"
                  value={branding.logoUrl ?? ""}
                  onChange={(e) => setBranding((b) => ({ ...b, logoUrl: e.target.value || null }))}
                  placeholder="https://…/logo.png"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-footer" className="text-muted-foreground">
                Footer
              </Label>
              <Input
                id="brand-footer"
                value={branding.footerText ?? ""}
                onChange={(e) => setBranding((b) => ({ ...b, footerText: e.target.value || null }))}
                placeholder={`Sent by ${orgName}`}
              />
            </div>
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={!dirty || mutation.isPending}
            >
              {dirty ? "Save brand template" : "Saved"}
            </Button>
          </div>

          <EmailPreviewFrame
            title="Brand preview"
            srcDoc={previewHtml}
            className="h-80"
            header={
              <div className="border-b border-border px-4 py-2 text-2xs uppercase tracking-wide text-muted-foreground">
                Preview
              </div>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
