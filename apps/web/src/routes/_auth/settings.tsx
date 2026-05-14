import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme, type Theme } from "@/components/theme-provider";
import { BUSINESS_NAME } from "@/lib/branding";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_auth/settings")({
  component: UserSettings,
  head: () => pageHead("Settings"),
});

function UserSettings() {
  return (
    <AppShell title="User settings" description="Manage preferences for your account.">
      <div className="mx-auto max-w-2xl space-y-8">
        <ThemeSettingsCard />
      </div>
    </AppShell>
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
      <CardContent className="space-y-2">
        <Label htmlFor="theme">Theme</Label>
        <Select value={theme} onValueChange={(value) => value && setTheme(value as Theme)}>
          <SelectTrigger id="theme" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          System follows your OS preference. You can also press D outside inputs to toggle light and
          dark.
        </p>
      </CardContent>
    </Card>
  );
}
