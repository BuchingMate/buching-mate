import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { eq } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";
import { member, orgSettings } from "./db/schema";
import { ac, owner, admin, manager, viewer } from "./auth/permissions";
import { sendInviteEmail } from "./auth/email";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUpdated,
} from "./ee/billing/webhook";
import { syncSeatCount } from "./ee/billing/polar";

const polarClient = process.env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: (process.env.POLAR_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
    })
  : null;

const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

async function orgPlanFor(orgId: string): Promise<"free" | "team" | "enterprise"> {
  const rows = await db
    .select({ plan: orgSettings.plan })
    .from(orgSettings)
    .where(eq(orgSettings.orgId, orgId))
    .limit(1);
  return (rows[0]?.plan ?? "free") as "free" | "team" | "enterprise";
}

const organizationPlugin = organization({
  organizationLimit: 1,
  ac,
  roles: { owner, admin, manager, viewer },
  organizationHooks: {
    beforeAddMember: async ({ member: memberData, user }) => {
      const existing = await db.select().from(member).where(eq(member.userId, user.id));
      if (existing.length > 0) {
        throw new Error("User already belongs to an organization");
      }
      return { data: memberData };
    },
    afterAddMember: async ({ member: memberData }) => {
      void syncSeatCount(memberData.organizationId);
    },
    afterRemoveMember: async ({ member: memberData }) => {
      void syncSeatCount(memberData.organizationId);
    },
    beforeUpdateOrganization: async ({ organization: org, member: memberData }) => {
      if (!("slug" in org) || org.slug === undefined) return;
      const plan = await orgPlanFor(memberData.organizationId);
      if (plan === "free") {
        throw new Error("Custom subdomain requires Team plan");
      }
    },
    beforeAcceptInvitation: async ({ user }) => {
      const existing = await db.select().from(member).where(eq(member.userId, user.id));
      if (existing.length > 0) {
        throw new Error("Already in an organization");
      }
    },
  },
  membershipLimit: async (_user, org) => {
    const plan = await orgPlanFor(org.id);
    if (plan === "free") return 1;
    return Number.MAX_SAFE_INTEGER;
  },
  sendInvitationEmail: async (data) => {
    const webUrl = process.env.WEB_URL || "http://localhost:5678";
    const inviteLink = `${webUrl}/invite/${data.id}`;
    await sendInviteEmail({
      email: data.email,
      organizationName: data.organization.name,
      inviteLink,
    });
  },
});

const teamProductId = process.env.POLAR_PRODUCT_TEAM;

const polarPlugin = polarClient
  ? polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: teamProductId ? [{ productId: teamProductId, slug: "team" }] : [],
          successUrl: `${process.env.WEB_URL}/admin?tab=billing&success=1`,
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET || "",
          onSubscriptionCreated: handleSubscriptionCreated,
          onSubscriptionUpdated: handleSubscriptionUpdated,
          onSubscriptionActive: handleSubscriptionActive,
          onSubscriptionCanceled: handleSubscriptionCanceled,
          onSubscriptionRevoked: handleSubscriptionRevoked,
        }),
      ],
    })
  : null;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.WEB_URL || "http://localhost:5678"],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: googleProvider,
  plugins: polarPlugin ? [organizationPlugin, polarPlugin] : [organizationPlugin],
});
