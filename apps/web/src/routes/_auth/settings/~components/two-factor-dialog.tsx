import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AlertCircle, Copy, Download, ShieldCheck } from "lucide-react";
import { QRCode } from "react-qr-code";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authKeys } from "@/queries/auth";

export function TwoFactorDialog({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);

  const reset = () => {
    setPassword("");
    setVerificationCode("");
    setError("");
    setSetup(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const enable = useMutation({
    mutationFn: async () => {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to enable two-factor authentication.");
      }
      return result.data;
    },
    onSuccess: async (data) => {
      setPassword("");
      setError("");
      setSetup(data);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to enable two-factor authentication.");
    },
  });

  const disable = useMutation({
    mutationFn: async () => {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to disable two-factor authentication.");
      }
    },
    onSuccess: async () => {
      reset();
      setOpen(false);
      toast.success("Two-factor authentication disabled.");
      await queryClient.invalidateQueries({ queryKey: authKeys.session });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to disable two-factor authentication.");
    },
  });

  const verifySetup = useMutation({
    mutationFn: async () => {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode.trim(),
        trustDevice: false,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Invalid two-factor code.");
      }
    },
    onSuccess: async () => {
      reset();
      setOpen(false);
      toast.success("Two-factor authentication enabled.");
      await queryClient.invalidateQueries({ queryKey: authKeys.session });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Invalid two-factor code.");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (twoFactorEnabled) {
      disable.mutate();
      return;
    }
    enable.mutate();
  };

  const submitSetupVerification = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    verifySetup.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="font-medium">Two-factor authentication</p>
              <Badge variant={twoFactorEnabled ? "success" : "secondary"}>
                {twoFactorEnabled ? "Enabled" : "Off"}
              </Badge>
            </div>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
            </DialogTrigger>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add an authenticator app code after password sign-in.
          </p>
        </div>
      </div>

      <DialogContent className="overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}</DialogTitle>
          <DialogDescription>
            {twoFactorEnabled
              ? "Enter your password to turn off authenticator app verification."
              : "Enter your password, then scan the setup code with an authenticator app."}
          </DialogDescription>
        </DialogHeader>

        {setup ? (
          <form onSubmit={submitSetupVerification} className="flex flex-col gap-5 overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex justify-center sm:block">
                <div className="shrink-0 rounded-md bg-background p-3">
                  <QRCode value={setup.totpURI} size={144} />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="font-medium">Scan this QR code</p>
                  <p className="text-sm text-muted-foreground">
                    Add this account to your authenticator app. If scanning fails, enter the setup
                    key manually.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Setup key</Label>
                  <div className="relative">
                    <code className="block break-all rounded-md border bg-muted/30 px-2 py-1.5 pr-9 text-xs font-medium leading-relaxed">
                      {totpSecret(setup.totpURI)}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyTotpSecret(setup.totpURI)}
                      className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Copy setup key"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">Backup codes</p>
                  <p className="text-xs text-muted-foreground">
                    Store these somewhere safe. Each code can be used once.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void copyAllBackupCodes(setup.backupCodes)}
                  >
                    <Copy className="size-3" />
                    Copy all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void downloadBackupCodes(setup.backupCodes)}
                  >
                    <Download className="size-3" />
                    Download
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                {setup.backupCodes.map((code) => (
                  <code
                    key={code}
                    className="truncate rounded-md border bg-muted/30 px-2 py-1.5 text-center"
                  >
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setupVerificationCode">Verification code</Label>
              <Input
                id="setupVerificationCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                After saving your backup codes, enter the current code from your authenticator app
                to finish setup.
              </p>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={verifySetup.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={verifySetup.isPending}>
                {verifySetup.isPending ? "Verifying…" : "Verify and finish"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twoFactorPassword">Password</Label>
              <Input
                id="twoFactorPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={enable.isPending || disable.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={enable.isPending || disable.isPending}>
                {twoFactorEnabled ? "Disable" : "Enable"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function totpSecret(totpURI: string) {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? totpURI;
  } catch {
    return totpURI;
  }
}

async function copyTotpSecret(totpURI: string) {
  await navigator.clipboard.writeText(totpSecret(totpURI));
  toast.success("Setup key copied.");
}

async function copyAllBackupCodes(codes: string[]) {
  const text = codes.join("\n");
  await navigator.clipboard.writeText(text);
  toast.success("All backup codes copied.");
}

function downloadBackupCodes(codes: string[]) {
  const text = codes.join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "backup-codes.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Backup codes downloaded.");
}
