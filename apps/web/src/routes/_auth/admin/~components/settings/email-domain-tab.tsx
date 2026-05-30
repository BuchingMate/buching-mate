import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmailDomainStatus } from "@workspace/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createOrgEmailDomain,
  deleteOrgEmailDomain,
  verifyOrgEmailDomain,
} from "@/lib/org-email-domain";
import { currentOrgQueryOptions } from "@/queries/auth";
import { orgEmailDomainKeys, orgEmailDomainQueryOptions } from "@/queries/org-email-domain";

const STATUS_VARIANT: Record<EmailDomainStatus, "success" | "destructive" | "outline"> = {
  active: "success",
  failed: "destructive",
  pending: "outline",
  verifying: "outline",
};

const STATUS_LABEL: Record<EmailDomainStatus, string> = {
  active: "Verified",
  failed: "Failed",
  pending: "Not started",
  verifying: "Waiting for DNS",
};

export function EmailDomainTab() {
  const orgQuery = useQuery(currentOrgQueryOptions);
  const domainQuery = useQuery(orgEmailDomainQueryOptions);
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");

  const plan = orgQuery.data?.org.plan ?? "free";
  const domain = domainQuery.data?.domain ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: orgEmailDomainKeys.all });

  const addMutation = useMutation({
    mutationFn: (name: string) => createOrgEmailDomain(name),
    onSuccess: () => {
      setInput("");
      invalidate();
    },
  });
  const verifyMutation = useMutation({ mutationFn: verifyOrgEmailDomain, onSuccess: invalidate });
  const removeMutation = useMutation({ mutationFn: deleteOrgEmailDomain, onSuccess: invalidate });

  const busy = addMutation.isPending || verifyMutation.isPending || removeMutation.isPending;

  if (plan === "free") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Custom sending domain</CardTitle>
            <CardDescription>
              Send event email from your own domain instead of the platform address. This is part of
              the Team plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTitle>Upgrade to Team</AlertTitle>
              <AlertDescription>
                Free organizations send from the platform address with your name shown. Upgrade to
                send from your own domain.
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
          <CardTitle>Custom sending domain</CardTitle>
          <CardDescription>
            Send event email from your own domain. Add a domain, publish the DNS records it gives
            you, then verify. Until then, email sends from the platform address with your name
            shown.
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
                placeholder="mail.acme.com"
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
                    <span className="font-medium text-sm">{domain.domain}</span>
                    <Badge variant={STATUS_VARIANT[domain.status]} className="text-xs">
                      {STATUS_LABEL[domain.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {domain.status === "active"
                      ? "Email now sends from this domain."
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
                Could not add that domain. Check the name and that your plan allows it.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
