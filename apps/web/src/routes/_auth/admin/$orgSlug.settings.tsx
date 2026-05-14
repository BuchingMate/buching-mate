import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrgRole } from "@workspace/contracts";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/components/access-denied";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  canDeleteOrg,
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
import { DangerTab } from "./~components/settings/danger-tab";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_auth/admin/$orgSlug/settings")({
  component: OrganizationSettings,
  head: () => pageHead("Organization settings"),
});

function OrganizationSettings() {
  const { orgSlug } = Route.useParams();
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
      <SettingsTabs orgSlug={orgSlug} role={role!} />
    </AppShell>
  );
}

function SettingsTabs({ orgSlug, role }: { orgSlug: string; role: OrgRole }) {
  const [tab, setTab] = useState("general");
  const showDanger = canDeleteOrg(role);
  const showPayments = canManagePayments(role);
  const showWebhooks = canManageWebhooks(role);

  return (
    <div className="mx-auto max-w-3xl">
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          {showWebhooks && <TabsTrigger value="webhooks">Webhooks</TabsTrigger>}
          {showPayments && <TabsTrigger value="payments">Payments</TabsTrigger>}
          <TabsTrigger value="members">Members</TabsTrigger>
          {showDanger && <TabsTrigger value="danger">Danger</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralTab orgSlug={orgSlug} />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>
        {showWebhooks && (
          <TabsContent value="webhooks" className="mt-6">
            <WebhooksTab />
          </TabsContent>
        )}
        {showPayments && (
          <TabsContent value="payments" className="mt-6">
            <PaymentsTab />
          </TabsContent>
        )}
        <TabsContent value="members" className="mt-6">
          <MembersTab role={role} />
        </TabsContent>
        {showDanger && (
          <TabsContent value="danger" className="mt-6">
            <DangerTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
