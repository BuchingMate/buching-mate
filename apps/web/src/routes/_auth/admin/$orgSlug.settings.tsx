import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrgRole } from "@workspace/contracts";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/components/access-denied";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  canDeleteOrg,
  canManageBilling,
  canManageConnectedApps,
  canManagePayments,
  canManageSettings,
  canManageWebhooks,
} from "@/lib/permissions";
import { currentOrgQueryOptions } from "@/queries/auth";
import { GeneralTab } from "./~components/settings/general-tab";
import { CategoriesTab } from "./~components/settings/categories-tab";
import { WebhooksTab } from "./~components/settings/webhooks-tab";
import { MembersTab } from "./~components/settings/members-tab";
import { PaymentsTab } from "./~components/settings/payments-tab";
import { VideoTab } from "./~components/settings/video-tab";
import { EmailDomainTab } from "./~components/settings/email-domain-tab";
import { BillingTab } from "./~components/settings/billing-tab";
import { BroadcastPlanCard } from "./~components/settings/broadcast-plan-card";
import { DangerTab } from "./~components/settings/danger-tab";

const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === "true";
import { pageHead } from "@/lib/seo";

const VALID_TABS = ["general", "members", "billing", "integrations", "advanced"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export const Route = createFileRoute("/_auth/admin/$orgSlug/settings")({
  component: OrganizationSettings,
  head: () => pageHead("Organization settings"),
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } => {
    const raw = search.tab;
    return typeof raw === "string" && (VALID_TABS as readonly string[]).includes(raw)
      ? { tab: raw as SettingsTab }
      : {};
  },
});

function OrganizationSettings() {
  const { orgSlug } = Route.useParams();
  const { tab: searchTab } = Route.useSearch();
  const navigate = useNavigate();
  const orgQuery = useQuery(currentOrgQueryOptions);
  const role = orgQuery.data?.memberRole;

  if (orgQuery.isLoading) {
    return (
      <AppShell title="Organization settings" description="Manage organization-wide settings.">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!canManageSettings(role)) {
    return (
      <AppShell title="Organization settings" description="Manage organization-wide settings.">
        <div className="mx-auto max-w-md">
          <AccessDenied
            message="Admins and owners can manage organization settings. Contact an admin if you need changes."
            onBack={() => void navigate({ to: "/admin" })}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Organization settings" description="Manage organization-wide settings.">
      <SettingsTabs orgSlug={orgSlug} role={role!} initialTab={searchTab ?? "general"} />
    </AppShell>
  );
}

function SettingsTabs({
  orgSlug,
  role,
  initialTab,
}: {
  orgSlug: string;
  role: OrgRole;
  initialTab: SettingsTab;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const showDanger = canDeleteOrg(role);
  const showPayments = canManagePayments(role);
  const showConnectedApps = canManageConnectedApps(role);
  const showSettings = canManageSettings(role);
  const showWebhooks = canManageWebhooks(role);
  const showBilling = BILLING_ENABLED && canManageBilling(role);
  const showIntegrations = showWebhooks || showConnectedApps || showPayments;

  return (
    <div className="mx-auto max-w-5xl">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v && (VALID_TABS as readonly string[]).includes(String(v))) setTab(v as SettingsTab);
        }}
      >
        <TabsList className="flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {showBilling && <TabsTrigger value="billing">Billing</TabsTrigger>}
          {showIntegrations && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
          {showDanger && <TabsTrigger value="advanced">Advanced</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <GeneralTab orgSlug={orgSlug} />
          <CategoriesTab />
          {showSettings && <EmailDomainTab />}
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersTab role={role} />
        </TabsContent>

        {showBilling && (
          <TabsContent value="billing" className="mt-6 space-y-6">
            <BillingTab orgSlug={orgSlug} />
            <BroadcastPlanCard />
          </TabsContent>
        )}

        {showIntegrations && (
          <TabsContent value="integrations" className="mt-6 space-y-6">
            {showPayments && <PaymentsTab />}
            {showWebhooks && <WebhooksTab />}
            {showConnectedApps && <VideoTab />}
          </TabsContent>
        )}

        {showDanger && (
          <TabsContent value="advanced" className="mt-6">
            <DangerTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
