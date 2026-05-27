import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type PlanPricing, TEAM_BENEFITS } from "@workspace/contracts";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { getBillingPortalUrl } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { currentOrgQueryOptions } from "@/queries/auth";
import { planPricingQueryOptions, subscriptionInfoQueryOptions } from "@/queries/billing";
import { orgSeatUsageQueryOptions } from "@/queries/org";

const planLabel: Record<string, string> = { free: "Free", team: "Team", enterprise: "Enterprise" };

// cents → "$50" (drop cents when whole, else "$50.50").
function money(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

async function openPortal() {
  const { url } = await getBillingPortalUrl();
  window.location.href = url;
}

export function TeamPlanCard() {
  const orgQuery = useQuery(currentOrgQueryOptions);
  const seatsQuery = useQuery(orgSeatUsageQueryOptions);
  const pricingQuery = useQuery(planPricingQueryOptions);
  const subQuery = useQuery(subscriptionInfoQueryOptions);

  const orgId = orgQuery.data?.org.id ?? "";
  const plan = orgQuery.data?.org.plan ?? "free";
  const seats = seatsQuery.data;

  const seatLine = seats ? (
    <p className="text-xs text-muted-foreground tabular-nums">
      {seats.cap == null
        ? `${seats.used} admin seats used`
        : `${seats.used} of ${seats.cap} admin seats used`}
    </p>
  ) : null;

  if (plan !== "free") {
    const sub = subQuery.data;
    const intervalLabel =
      sub?.interval === "year" ? "Annual" : sub?.interval === "month" ? "Monthly" : null;
    const renews = sub?.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd).toLocaleDateString()
      : null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan <Badge>{planLabel[plan]}</Badge>
            {intervalLabel && <Badge variant="outline">{intervalLabel}</Badge>}
          </CardTitle>
          <CardDescription>
            {sub?.cancelAtPeriodEnd && renews
              ? `Cancels on ${renews}.`
              : renews
                ? `Renews on ${renews}.`
                : "Manage your subscription, seats, and billing details."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {seatLine}
          <BenefitList />
          <Button variant="outline" onClick={openPortal}>
            Manage subscription
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <UpgradeCard orgId={orgId} pricing={pricingQuery.data ?? null} seatLine={seatLine} />;
}

function UpgradeCard({
  orgId,
  pricing,
  seatLine,
}: {
  orgId: string;
  pricing: { monthly: PlanPricing | null; annual: PlanPricing | null } | null;
  seatLine: React.ReactNode;
}) {
  const hasAnnual = !!pricing?.annual;
  const [interval, setInterval] = useState<"month" | "year">("month");
  const active = interval === "year" && hasAnnual ? pricing!.annual! : (pricing?.monthly ?? null);

  // Annual is billed yearly; show the monthly-equivalent and the saving vs paying monthly.
  const perMonthCents = active
    ? active.interval === "year"
      ? Math.round(active.basePriceCents / 12)
      : active.basePriceCents
    : null;
  const extraPerMonthCents = active
    ? active.interval === "year"
      ? Math.round(active.extraSeatPriceCents / 12)
      : active.extraSeatPriceCents
    : null;
  const savePct =
    pricing?.monthly && pricing.annual
      ? Math.round(
          (1 - pricing.annual.basePriceCents / (pricing.monthly.basePriceCents * 12)) * 100,
        )
      : 0;

  async function upgrade() {
    await authClient.checkout({
      slug: interval === "year" ? "team-annual" : "team",
      ...(orgId ? { metadata: { orgId } } : {}),
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Upgrade to</p>
            <CardTitle className="text-xl">Team</CardTitle>
          </div>
          {hasAnnual && (
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(["month", "year"] as const).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => setInterval(iv)}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition-colors",
                    interval === iv
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {iv === "month" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {perMonthCents != null ? (
          <div className="flex items-end gap-2">
            <span className="text-4xl font-semibold tracking-tight">{money(perMonthCents)}</span>
            <span className="pb-1 text-sm text-muted-foreground">
              per month{interval === "year" ? ", billed annually" : ""}
            </span>
            {interval === "year" && savePct > 0 && (
              <Badge className="mb-1.5 bg-green-500/15 text-green-600 dark:text-green-400">
                Save {savePct}%
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Unlock unlimited members, your own sending domain, and more.
          </p>
        )}

        <BenefitList />

        <Button className="w-full" onClick={upgrade}>
          Upgrade to Team
        </Button>

        {extraPerMonthCents != null && (
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
            <span>Additional admins</span>
            <span className="tabular-nums">{money(extraPerMonthCents)} / mo</span>
          </div>
        )}
        {seatLine}
      </CardContent>
    </Card>
  );
}

function BenefitList() {
  return (
    <ul className="space-y-1.5">
      {TEAM_BENEFITS.map((benefit) => (
        <li key={benefit} className="flex items-center gap-2 text-sm">
          <Check className="size-4 shrink-0 text-primary" />
          {benefit}
        </li>
      ))}
    </ul>
  );
}
