import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ResendState = "idle" | "sending" | "sent" | "error";

export function ResendVerificationButton({
  email,
  callbackPath,
  className,
  variant = "outline",
  showError = false,
}: {
  email: string;
  callbackPath: string;
  className?: string;
  variant?: "outline" | "default";
  showError?: boolean;
}) {
  const [state, setState] = useState<ResendState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = async () => {
    setState("sending");
    setErrorMsg("");
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}${callbackPath}`,
      });
      if (result.error) {
        setErrorMsg(result.error.message ?? "Unable to resend");
        setState("error");
        return;
      }
      setState("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to resend");
      setState("error");
    }
  };

  const label =
    state === "sending"
      ? "Resending..."
      : state === "sent"
        ? "Email resent"
        : state === "error"
          ? "Retry resend"
          : "Resend verification email";

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        className={className ?? "w-full"}
        onClick={handleClick}
        disabled={state === "sending" || state === "sent"}
      >
        {label}
      </Button>
      {showError && state === "error" && errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
