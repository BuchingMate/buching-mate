import { useQuery } from "@tanstack/react-query";
import {
  BROADCAST_TIERS,
  TEAM_INCLUDED_WEEKLY_SENDS,
  type BroadcastTier,
} from "@workspace/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { getBillingPortalUrl } from "@/lib/billing";
import { currentOrgQueryOptions } from "@/queries/auth";
import { orgSettingsQueryOptions } from "@/queries/org";

const sendsFmt = new Intl.NumberFormat("en-US");

function priceLabel(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}/mo`;
}

// Subscribe to a capacity add-on. orgId rides along as metadata so the Polar
// webhook can map the new subscription back to this org.
async function subscribe(slug: string, orgId: string) {
  await authClient.checkout({ slug, metadata: { orgId } });
}

async function openPortal() {
  const { url } = await getBillingPortalUrl();
  window.location.href = url;
}

export function BroadcastPlanCard() {
  const orgQuery = useQuery(currentOrgQueryOptions);
  const settingsQuery = useQuery(orgSettingsQueryOptions);

  const orgId = orgQuery.data?.org.id ?? "";
  const plan = orgQuery.data?.org.plan ?? "free";
  const cap = settingsQuery.data?.settings.broadcastWeeklyCap ?? TEAM_INCLUDED_WEEKLY_SENDS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Broadcast volume</CardTitle>
        <CardDescription>
          Your plan sends {sendsFmt.format(cap)} newsletter and invitation recipients per week.
          Sends to an event&apos;s own guests are always free and never counted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {plan === "free" ? (
          <Alert>
            <AlertTitle>Upgrade to Team</AlertTitle>
            <AlertDescription>
              Team includes {sendsFmt.format(TEAM_INCLUDED_WEEKLY_SENDS)} sends per week. Add-ons
              that raise this further are available once you are on Team.
            </AlertDescription>
          </Alert>
        ) : (
          <TierTable cap={cap} orgId={orgId} hasAddon={cap > TEAM_INCLUDED_WEEKLY_SENDS} />
        )}
      </CardContent>
    </Card>
  );
}

function TierTable({ cap, orgId, hasAddon }: { cap: number; orgId: string; hasAddon: boolean }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Weekly sends</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            <TierRow
              sends={TEAM_INCLUDED_WEEKLY_SENDS}
              included
              current={cap === TEAM_INCLUDED_WEEKLY_SENDS}
            />
            {BROADCAST_TIERS.map((tier) => (
              <Tier key={tier.slug} tier={tier} cap={cap} orgId={orgId} hasAddon={hasAddon} />
            ))}
          </tbody>
        </table>
      </div>
      {hasAddon ? (
        <div className="space-y-1">
          <Button variant="outline" size="sm" onClick={openPortal}>
            Change or cancel add-on
          </Button>
          <p className="text-xs text-muted-foreground">
            You have one active add-on. Switch tiers or cancel it in the billing portal — only one
            add-on can be active at a time.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// While an add-on is active, tier switching happens in the Polar portal (one
// subscription, switched in place), so the per-tier "Choose" buttons are hidden to
// prevent stacking a second add-on.
function Tier({
  tier,
  cap,
  orgId,
  hasAddon,
}: {
  tier: BroadcastTier;
  cap: number;
  orgId: string;
  hasAddon: boolean;
}) {
  return (
    <TierRow
      sends={tier.weeklyCap}
      price={priceLabel(tier.monthlyPriceCents)}
      current={cap === tier.weeklyCap}
      onSubscribe={hasAddon ? undefined : () => subscribe(tier.slug, orgId)}
    />
  );
}

function TierRow({
  sends,
  price,
  included,
  current,
  onSubscribe,
}: {
  sends: number;
  price?: string;
  included?: boolean;
  current: boolean;
  onSubscribe?: () => void;
}) {
  return (
    <tr className="border-t border-border tabular-nums">
      <td className="px-4 py-2.5 font-medium">{sendsFmt.format(sends)}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{included ? "Included" : price}</td>
      <td className="px-4 py-2.5 text-right">
        {current ? (
          <Badge variant="secondary">Current</Badge>
        ) : onSubscribe ? (
          <Button size="sm" variant="outline" onClick={onSubscribe}>
            Choose
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
