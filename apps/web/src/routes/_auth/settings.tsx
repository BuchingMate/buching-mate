import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Bell,
  KeyRound,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme, type Theme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { BUSINESS_NAME } from "@/lib/branding";
import { pageHead } from "@/lib/seo";
import { authKeys, sessionQueryOptions } from "@/queries/auth";
import { TwoFactorDialog } from "./settings/~components/two-factor-dialog";

export const Route = createFileRoute("/_auth/settings")({
  component: UserSettings,
  head: () => pageHead("Settings"),
});

const notificationGroups = [
  {
    title: "Events you manage",
    rows: ["New registrations", "Cancellations", "Waitlist changes"],
  },
  {
    title: "Reviews and publishing",
    rows: ["Approval requests", "Approved events", "Rejected events"],
  },
  {
    title: "Business activity",
    rows: ["Paid bookings", "Payment failures", "Broadcast results"],
  },
] as const;

function UserSettings() {
  return (
    <AppShell
      title="User settings"
      description="Manage your personal account and workspace defaults."
    >
      <div className="mx-auto max-w-4xl">
        <Tabs defaultValue="account" className="gap-8">
          <TabsList variant="line" className="w-full justify-start border-b pb-0">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="pt-1">
            <AccountTab />
          </TabsContent>
          <TabsContent value="preferences" className="pt-1">
            <PreferencesTab />
          </TabsContent>
          <TabsContent value="notifications" className="pt-1">
            <NotificationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function AccountTab() {
  const sessionQuery = useQuery(sessionQueryOptions);
  const user = sessionQuery.data?.user;

  return (
    <div className="space-y-8">
      <ProfileForm user={user} />

      <Card>
        <CardHeader>
          <CardTitle>Password &amp; Security</CardTitle>
          <CardDescription>Security controls worth keeping close to the account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border">
            <SettingsRow
              icon={Mail}
              title="Email address"
              description="Used for sign-in, team invitations, and operational updates."
              meta="Active"
            />
          </div>
          <div className="rounded-lg border">
            <PasswordChangeForm />
          </div>
          <div className="rounded-lg border">
            <TwoFactorManagement />
          </div>
          <div className="rounded-lg border">
            <PasskeysManagement />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileForm({
  user,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const [first = "", ...rest] = (user?.name ?? "").trim().split(/\s+/).filter(Boolean);
    setFirstName(first);
    setLastName(rest.join(" "));
    setImage(user?.image ?? "");
  }, [user]);

  const displayName = [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const initial = displayName[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U";

  const updateProfile = useMutation({
    mutationFn: async () => {
      const result = await authClient.updateUser({
        name: displayName || undefined,
        image: image.trim() || undefined,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to save profile.");
      }
    },
    onSuccess: async () => {
      setError("");
      toast.success("Profile updated.");
      await queryClient.invalidateQueries({ queryKey: authKeys.session });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    updateProfile.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Your Profile</h2>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(14rem,1fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Primary email</Label>
            <div className="min-h-9 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {user?.email ?? "No email on file"}
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        <div className="space-y-3">
          <Label htmlFor="profileImage">Profile Picture</Label>
          <div className="flex items-center gap-4">
            <Avatar className="size-24" size="lg">
              {image ? <AvatarImage src={image} alt="" /> : null}
              <AvatarFallback className="text-2xl font-semibold">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                id="profileImage"
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="Image URL"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Leave blank to use initials.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function PasswordChangeForm() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [error, setError] = useState("");

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setRevokeOtherSessions(true);
    setError("");
  };

  const changePassword = useMutation({
    mutationFn: async () => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Unable to change password. Try again.");
      }
    },
    onSuccess: () => {
      reset();
      setOpen(false);
      toast.success("Password updated.");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to change password. Try again.");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setError("");
    changePassword.mutate();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">Change password</p>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Change password
            </DialogTrigger>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your current password before setting a new one.
          </p>
        </div>
      </div>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password before setting a new one.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={revokeOtherSessions}
              onCheckedChange={(checked) => setRevokeOtherSessions(Boolean(checked))}
            />
            <span className="leading-5 text-muted-foreground">
              Sign out other active sessions after changing my password.
            </span>
          </label>

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
              disabled={changePassword.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TwoFactorManagement() {
  const sessionQuery = useQuery(sessionQueryOptions);
  const twoFactorEnabled = Boolean(
    (sessionQuery.data?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled,
  );

  return <TwoFactorDialog twoFactorEnabled={twoFactorEnabled} />;
}

type PasskeyRecord = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
  deviceType?: string | null;
  backedUp?: boolean | null;
};

function PasskeysManagement() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;
  const passkeysQuery = useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn: async () => {
      const result = await authClient.passkey.listUserPasskeys();
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to load passkeys.");
      }
      return (result.data ?? []) as PasskeyRecord[];
    },
  });

  const addPasskey = useMutation({
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey({
        name: name.trim() || undefined,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to add passkey.");
      }
    },
    onSuccess: async () => {
      setName("");
      setError("");
      toast.success("Passkey added.");
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to add passkey.");
    },
  });

  const deletePasskey = useMutation({
    mutationFn: async (id: string) => {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to delete passkey.");
      }
    },
    onSuccess: async () => {
      setError("");
      toast.success("Passkey deleted.");
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to delete passkey.");
    },
  });

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">Passkeys</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!supported || addPasskey.isPending}
              onClick={() => addPasskey.mutate()}
            >
              <Plus className="size-4" />
              Add passkey
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with this device's secure unlock method.
          </p>
        </div>
      </div>

      <div className="ml-11 space-y-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Optional passkey name"
          aria-label="Passkey name"
        />
        {!supported ? (
          <p className="text-sm text-muted-foreground">
            Passkeys require a browser with WebAuthn support and a secure context.
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="divide-y overflow-hidden rounded-md border">
          {passkeysQuery.isPending ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Loading passkeys…</p>
          ) : passkeysQuery.data && passkeysQuery.data.length > 0 ? (
            passkeysQuery.data.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {passkey.name || "Unnamed passkey"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatPasskeyMeta(passkey)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${passkey.name || "passkey"}`}
                  disabled={deletePasskey.isPending}
                  onClick={() => deletePasskey.mutate(passkey.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">No passkeys yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPasskeyMeta(passkey: PasskeyRecord) {
  const parts = [passkey.deviceType, passkey.backedUp ? "backed up" : null].filter(Boolean);
  const createdAt = passkey.createdAt ? new Date(passkey.createdAt).toLocaleDateString() : null;
  if (createdAt) parts.push(`added ${createdAt}`);
  return parts.length > 0 ? parts.join(" · ") : "Registered passkey";
}

function PreferencesTab() {
  return (
    <div className="max-w-2xl">
      <ThemeSettingsCard />
    </div>
  );
}

export function ThemeSettingsCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how {BUSINESS_NAME} looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="theme">Theme</Label>
            <p className="text-sm text-muted-foreground">System follows your OS preference.</p>
          </div>
          <Select value={theme} onValueChange={(value) => value && setTheme(value as Theme)}>
            <SelectTrigger id="theme" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            The useful controls for {BUSINESS_NAME}: event operations, reviews, payments, and
            broadcasts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationGroups.map((group) => (
            <section key={group.title} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{group.title}</h3>
              <div className="overflow-hidden rounded-lg border">
                {group.rows.map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row}</p>
                      <p className="text-xs text-muted-foreground">Per-user email preference</p>
                    </div>
                    <Badge variant="outline">Email</Badge>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended scope</CardTitle>
          <CardDescription>
            Keep user notifications smaller than organization settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsRow
              icon={Bell}
              title="Email first"
              description="Do not add SMS until SMS reminders exist."
            />
            <SettingsRow
              icon={UserRound}
              title="Personal only"
              description="Payment, webhooks, and branding belong to organization settings."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  description,
  meta,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">{title}</p>
          {meta ? <Badge variant="secondary">{meta}</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
