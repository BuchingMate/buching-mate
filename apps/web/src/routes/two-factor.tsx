import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authKeys } from "@/queries/auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/two-factor")({
  component: TwoFactorPage,
  head: () => pageHead("Two-factor verification"),
});

function TwoFactorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: code.trim(),
        trustDevice,
      });

      if (result.error) {
        setError(result.error.message ?? "Invalid two-factor code.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: authKeys.session });
      await queryClient.invalidateQueries({ queryKey: authKeys.currentOrg });
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid two-factor code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Two-factor verification</h1>
            <p className="text-muted-foreground">Enter the code from your authenticator app.</p>
            <p className="text-xs text-muted-foreground">
              Need to set it up first? Go to Settings after signing in.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="twoFactorCode">Code</Label>
            <Input
              id="twoFactorCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(Boolean(checked))}
            />
            <span className="leading-5 text-muted-foreground">Trust this device for 30 days.</span>
          </label>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
