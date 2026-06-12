import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomDomainStatus } from "@workspace/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createOrgCustomDomain,
  deleteOrgCustomDomain,
  verifyOrgCustomDomain,
} from "@/lib/org-custom-domain";
import { currentOrgQueryOptions } from "@/queries/auth";
import { orgCustomDomainKeys, orgCustomDomainQueryOptions } from "@/queries/org-custom-domain";

const STATUS_VARIANT: Record<CustomDomainStatus, "success" | "destructive" | "outline"> = {
  active: "success",
  failed: "destructive",
  pending: "outline",
  verifying: "outline",
  disabled: "outline",
};

const STATUS_LABEL: Record<CustomDomainStatus, string> = {
  active: "Live",
  failed: "Failed",
  pending: "Not started",
  verifying: "Waiting for DNS",
  disabled: "Disabled",
};

export function CustomDomainTab() {
  const orgQuery = useQuery(currentOrgQueryOptions);
  const domainQuery = useQuery(orgCustomDomainQueryOptions);
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");

  const plan = orgQuery.data?.org.plan ?? "free";
  const domain = domainQuery.data?.domain ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: orgCustomDomainKeys.all });

  const addMutation = useMutation({
    mutationFn: (name: string) => createOrgCustomDomain(name),
    onSuccess: () => {
      setInput("");
      invalidate();
    },
  });
  const verifyMutation = useMutation({ mutationFn: verifyOrgCustomDomain, onSuccess: invalidate });
  const removeMutation = useMutation({ mutationFn: deleteOrgCustomDomain, onSuccess: invalidate });

  const busy = addMutation.isPending || verifyMutation.isPending || removeMutation.isPending;

  if (plan === "free") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Custom domain</CardTitle>
            <CardDescription>
              Host your event pages on your own domain, like events.acme.com. This is part of the
              Team plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>Upgrade to Team</AlertTitle>
              <AlertDescription>
                Free organizations publish events to the shared events page. Upgrade to serve them
                from your own domain.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Custom domain</CardTitle>
          <CardDescription>
            Host your event pages on your own domain. Add a subdomain like events.acme.com, publish
            the DNS records it gives you, then verify. While the domain is live your events serve
            only there and leave the shared events page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!domain ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) addMutation.mutate(input.trim());
              }}
            >
              <Input
                placeholder="events.acme.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !input.trim()}>
                Add domain
              </Button>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{domain.hostname}</span>
                    <Badge variant={STATUS_VARIANT[domain.status]} className="text-xs">
                      {STATUS_LABEL[domain.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {domain.status === "active"
                      ? "Your public events now serve from this domain and no longer appear on the shared events page."
                      : "Add the records below to your DNS, then verify."}
                  </p>
                </div>
                <div className="flex gap-2">
                  {domain.status !== "active" && (
                    <Button size="sm" onClick={() => verifyMutation.mutate()} disabled={busy}>
                      Verify
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeMutation.mutate()}
                    disabled={busy}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {domain.dnsRecords.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="p-2 font-medium">Type</th>
                        <th className="p-2 font-medium">Name</th>
                        <th className="p-2 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domain.dnsRecords.map((record) => (
                        <tr key={`${record.type}-${record.name}`} className="border-t align-top">
                          <td className="p-2 font-mono">{record.type}</td>
                          <td className="p-2 font-mono break-all">{record.name}</td>
                          <td className="p-2 font-mono break-all">{record.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {addMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Could not add that domain. Check the name isn't already in use and that your plan
                allows it. Apex domains aren't supported — use a subdomain like events.acme.com.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
