import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authKeys, currentOrgQueryOptions } from "@/queries/auth";

export function DangerTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgQuery = useQuery(currentOrgQueryOptions);
  const org = orgQuery.data?.org;

  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!org) return;
    if (confirmText !== org.name) {
      setError("Organization name doesn't match");
      return;
    }
    setLoading(true);
    const result = await authClient.organization.delete({ organizationId: org.id });
    if (result.error) {
      setError(result.error.message ?? "Unable to delete organization");
      setLoading(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: authKeys.currentOrg });
    await navigate({ to: "/onboarding" });
  };

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>Irreversible. Owner only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => setShowModal(true)}
        >
          Delete organization
        </Button>

        {showModal && (
          <div className="space-y-4 rounded-md bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              This will permanently delete your organization and all associated data. Cannot be
              undone.
            </p>
            <p className="text-sm font-medium text-destructive">Type "{org?.name}" to confirm:</p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="border-destructive"
            />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setConfirmText("");
                  setError("");
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading ? "Deleting…" : "Delete organization"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
