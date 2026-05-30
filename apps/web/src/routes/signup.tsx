import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { sessionQueryOptions } from "@/queries/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { pageHead } from "@/lib/seo";
import { emailDomainHint, isEmailDomainAllowed } from "@/lib/email-domain";
import { TurnstileWidget, turnstileEnabled } from "@/components/turnstile-widget";

export const Route = createFileRoute("/signup")({
  component: Signup,
  head: () => pageHead("Sign up"),
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (session) {
      throw redirect({ to: "/admin" });
    }
  },
});

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState("");

  const handleResend = async () => {
    setResendState("sending");
    setResendError("");
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/onboarding`,
      });
      if (result.error) {
        setResendError(result.error.message ?? "Unable to resend");
        setResendState("error");
        return;
      }
      setResendState("sent");
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Unable to resend");
      setResendState("error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isEmailDomainAllowed(email)) {
      setError(emailDomainHint() ?? "Email domain not allowed");
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setError("Please complete the captcha");
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.signUp.email(
        {
          name,
          email,
          password,
        },
        {
          headers: captchaToken ? { "x-captcha-response": captchaToken } : undefined,
        },
      );

      if (result.error) {
        setError(result.error.message ?? "Unable to create account");
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/onboarding`,
    });
  };

  if (submitted) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a verification link to <span className="font-medium">{email}</span>. Click it
            to finish signing up.
          </p>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={resendState === "sending" || resendState === "sent"}
            >
              {resendState === "sending"
                ? "Resending..."
                : resendState === "sent"
                  ? "Email resent"
                  : "Resend email"}
            </Button>
            {resendState === "error" && (
              <Alert variant="destructive">
                <AlertDescription>{resendError}</AlertDescription>
              </Alert>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Wrong address?{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => {
                setSubmitted(false);
                setResendState("idle");
                setResendError("");
              }}
            >
              Go back
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-muted-foreground">Sign up to get started</p>
          {emailDomainHint() && (
            <p className="text-xs text-muted-foreground">{emailDomainHint()}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <InputGroup>
              <InputGroupInput
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <TurnstileWidget onToken={setCaptchaToken} />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs uppercase text-muted-foreground">Or continue with</span>
          <Separator className="flex-1" />
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignUp}>
          Google
        </Button>

        <p className="text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="font-medium underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
