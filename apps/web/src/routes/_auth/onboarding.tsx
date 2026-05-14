import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { OrgRole } from "@workspace/contracts";
import { authClient } from "@/lib/auth-client";
import { authKeys, currentOrgQueryOptions } from "@/queries/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { pageHead } from "@/lib/seo";

const INVITE_ROLES: OrgRole[] = ["admin", "manager", "viewer"];

export const Route = createFileRoute("/_auth/onboarding")({
  component: Onboarding,
  head: () => pageHead("Onboarding"),
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(currentOrgQueryOptions);
      throw redirect({ to: "/admin" });
    } catch (error) {
      if (error instanceof ApiError && error.code === "organization_required") {
        return;
      }
      throw error;
    }
  },
});

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("manager");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const generateSuffix = () => Math.random().toString(36).slice(2, 8);

  const resolveUniqueSlug = async (base: string): Promise<string> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}-${generateSuffix()}`;
      const res = await authClient.organization.checkSlug({ slug: candidate });
      if (res.data?.status) return candidate;
    }
    throw new Error("Unable to find an available slug");
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const base = slugify(name) || "org";
      const finalSlug = await resolveUniqueSlug(base);

      const result = await authClient.organization.create({ name, slug: finalSlug });
      if (result.error) {
        setError(result.error.message ?? "Unable to create organization");
        setLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: authKeys.currentOrg });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create organization");
    } finally {
      setLoading(false);
    }
  };

  const finishStep2 = async (sendInvite: boolean) => {
    setError("");
    setLoading(true);
    try {
      if (sendInvite && inviteEmail.trim()) {
        const result = await authClient.organization.inviteMember({
          email: inviteEmail.trim(),
          role: inviteRole as "owner" | "admin" | "member",
        });
        if (result.error) {
          setError(result.error.message ?? "Unable to send invitation");
          setLoading(false);
          return;
        }
      }
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invitation");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <StepDots step={step} />

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold">Create your organization</h1>
              <p className="text-muted-foreground">Set up your workspace to get started</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Continue"}
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold">Invite your team</h1>
              <p className="text-muted-foreground">
                Send an invite now or skip and add people later from settings.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteRole">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as OrgRole)}>
                  <SelectTrigger id="inviteRole" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => void finishStep2(false)}
                disabled={loading}
              >
                Skip
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => void finishStep2(true)}
                disabled={loading || !inviteEmail.trim()}
              >
                {loading ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2].map((n) => (
        <span
          key={n}
          className={cn(
            "h-1.5 w-8 rounded-full transition-colors",
            n <= step ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}
