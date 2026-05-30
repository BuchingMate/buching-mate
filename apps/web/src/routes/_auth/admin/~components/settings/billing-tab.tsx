import { useQuery } from "@tanstack/react-query";
import { currentOrgQueryOptions } from "@/queries/auth";
import { BillingHistoryCard } from "./billing-history-card";
import { TeamPlanCard } from "./team-plan-card";

export function BillingTab(_props: { orgSlug: string }) {
  const orgQuery = useQuery(currentOrgQueryOptions);
  const plan = orgQuery.data?.org.plan ?? "free";

  if (orgQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading billing…</div>;
  }

  return (
    <div className="space-y-6">
      <TeamPlanCard />
      {plan !== "free" && <BillingHistoryCard />}
    </div>
  );
}
