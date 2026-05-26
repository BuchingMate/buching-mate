import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { currentOrgQueryOptions } from "@/queries/auth";

const planLabel: Record<string, string> = {
  free: "Free",
  team: "Team",
  enterprise: "Enterprise",
};

export function BillingTab(_props: { orgSlug: string }) {
  const orgQuery = useQuery(currentOrgQueryOptions);
  const subsQuery = useQuery({
    queryKey: ["billing", "subscriptions"],
    queryFn: async () => {
      try {
        const res = await authClient.customer.subscriptions.list({
          query: { page: 1, limit: 10, active: true },
        });
        return res.data ?? null;
      } catch {
        return null;
      }
    },
    retry: false,
  });

  // Plan is the webhook-synced source of truth on the org. Do not derive it from
  // customer.subscriptions.list: that call 500s for team (seat-based) customers in
  // Polar's member model, which would mask an active Team plan as Free.
  const plan = orgQuery.data?.org.plan ?? "free";
  const active = subsQuery.data?.result?.items?.[0];

  async function startCheckout() {
    const orgId = orgQuery.data?.org.id;
    await authClient.checkout({ slug: "team", ...(orgId ? { metadata: { orgId } } : {}) });
  }

  async function openPortal() {
    await authClient.customer.portal();
  }

  if (orgQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading billing…</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan{" "}
            <Badge variant={plan === "free" ? "secondary" : "default"}>{planLabel[plan]}</Badge>
          </CardTitle>
          <CardDescription>
            {plan === "free"
              ? "Upgrade to unlock unlimited members and advanced features."
              : "Manage your subscription, seats, and billing details."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {plan === "free" ? (
            <Button onClick={startCheckout}>Upgrade to Team</Button>
          ) : (
            <Button variant="outline" onClick={openPortal}>
              Manage subscription
            </Button>
          )}
        </CardContent>
      </Card>

      {active ? (
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Status: {active.status}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div>Seats: {active.seats ?? 1}</div>
            {active.currentPeriodEnd ? (
              <div>Renews: {new Date(active.currentPeriodEnd).toLocaleDateString()}</div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
