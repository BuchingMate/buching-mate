import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { authKeys, sessionQueryOptions } from "@/queries/auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/invite/$invitationId")({
  component: Invite,
  head: () => pageHead("Accept invitation"),
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
});

function Invite() {
  const { invitationId } = useParams({ from: "/invite/$invitationId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkExistingOrg();
  }, []);

  const checkExistingOrg = async () => {
    const orgs = await authClient.organization.list();
    if (orgs.data && orgs.data.length > 0) {
      setError("You already belong to an organization.");
      setBlocked(true);
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    setError("");

    const result = await authClient.organization.acceptInvitation({
      invitationId,
    });

    if (result.error) {
      setError(result.error.message ?? "Unable to accept invitation");
      setLoading(false);
      return;
    }

    setSuccess(true);
    await queryClient.invalidateQueries({ queryKey: authKeys.currentOrg });
    setTimeout(() => {
      void navigate({ to: "/admin" });
    }, 2000);
  };

  if (success) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-success">Invitation accepted!</h1>
          <p>Redirecting to your organization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Organization Invitation</h1>
          <p className="text-muted-foreground">You've been invited to join an organization</p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 p-4"
          >
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!blocked && (
          <Button onClick={handleAccept} className="w-full" disabled={loading}>
            {loading ? "Accepting..." : error ? "Try again" : "Accept Invitation"}
          </Button>
        )}
      </div>
    </div>
  );
}
