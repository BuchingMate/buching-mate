import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";

const planLabel: Record<string, string> = {
  free: "Free",
  team: "Team",
  enterprise: "Enterprise",
};

export function BillingTab(_props: { orgSlug: string }) {
  const stateQuery = useQuery({
    queryKey: ["billing", "customer-state"],
    queryFn: async () => {
      const res = await authClient.customer.state();
      return res.data ?? null;
    },
  });

  const subsQuery = useQuery({
    queryKey: ["billing", "subscriptions"],
    queryFn: async () => {
      const res = await authClient.customer.subscriptions.list({
        query: { page: 1, limit: 10, active: true },
      });
      return res.data ?? null;
    },
  });

  const active = subsQuery.data?.result?.items?.[0];
  const plan = active ? "team" : "free";

  async function startCheckout() {
    await authClient.checkout({ slug: "team" });
  }

  async function openPortal() {
    await authClient.customer.portal();
  }

  if (stateQuery.isLoading || subsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading billing…</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan <Badge variant={plan === "free" ? "secondary" : "default"}>{planLabel[plan]}</Badge>
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
