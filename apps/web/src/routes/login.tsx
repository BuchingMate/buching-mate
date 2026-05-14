import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { attendeeAuthClient } from "@/lib/attendee-auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { getPublicRequestInfo } from "@/lib/public";
import {
  attendeeSessionQueryOptions,
  authKeys,
  sessionQueryOptions,
} from "@/queries/auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => pageHead("Sign in"),
  loader: async () => {
    const { slug } = await getPublicRequestInfo();
    return { isAttendee: slug !== null };
  },
  beforeLoad: async ({ context }) => {
    const { slug } = await getPublicRequestInfo();
    if (slug) {
      const attendeeSession = await context.queryClient.ensureQueryData(
        attendeeSessionQueryOptions,
      );
      if (attendeeSession) {
        throw redirect({ to: "/me" });
      }
      return;
    }
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session) {
      throw redirect({ to: "/admin" });
    }
  },
});

function Login() {
  const { isAttendee } = Route.useLoaderData();
  if (isAttendee) return <AttendeeLogin />;
  return <StaffLogin />;
}

function StaffLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in");
      setLoading(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: authKeys.session });
    await navigate({ to: "/admin" });
  };

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({ provider: "google", callbackURL: "/admin" });
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs uppercase text-muted-foreground">Or continue with</span>
          <Separator className="flex-1" />
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn}>
          Google
        </Button>

        <p className="text-center text-sm">
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

function AttendeeLogin() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const callbackURL = `${window.location.origin}/me`;
    const result = await attendeeAuthClient.signIn.magicLink({ email, callbackURL });

    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Unable to send sign-in link");
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-muted-foreground">We'll email you a link to sign in.</p>
        </div>

        {sent ? (
          <Alert>
            <AlertDescription>
              Check your inbox at <strong>{email}</strong> for a sign-in link.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Email me a sign-in link"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/events" className="font-medium underline">
            Back to events
          </Link>
        </p>
      </div>
    </div>
  );
}
