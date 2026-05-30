import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, organization, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { eq } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";
import { member, orgSettings } from "./db/schema";
import { ac, owner, admin, manager, viewer } from "./auth/permissions";
import { sendInviteEmail, sendVerifyEmail } from "./auth/email";
import { isDisposableEmail } from "./auth/disposable";
import { sanitizeOrgName } from "./auth/org-name";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUpdated,
} from "./ee/billing/webhook";
import {
  assertSeatAvailableForRole,
  broadcastTierCheckoutProducts,
  isSeatedRole,
  TEAM_PRODUCT_ANNUAL_ID,
} from "./ee/billing/polar";
import { BETTER_AUTH_URL, TRUSTED_ORIGINS, WEB_URL } from "./env";

const polarClient = process.env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: (process.env.POLAR_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
    })
  : null;

const allowedEmailDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function isEmailDomainAllowed(email: string): boolean {
  if (allowedEmailDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowedEmailDomains.includes(domain);
}

function passkeyRpId() {
  if (Bun.env.PASSKEY_RP_ID) return Bun.env.PASSKEY_RP_ID;
  const hostname = new URL(WEB_URL).hostname;
  if (hostname.endsWith(".lvh.me")) return "lvh.me";
  return hostname;
}

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
    beforeCreateOrganization: async ({ organization: org }) => {
      // Tenant-controlled string lands in outbound invite email subject; reject
      // URLs, length-cap, strip zero-width/RTL tricks.
      const cleanName = sanitizeOrgName(org.name ?? "");
      return { data: { ...org, name: cleanName } };
    },
    beforeAddMember: async ({ member: memberData, user }) => {
      const existing = await db.select().from(member).where(eq(member.userId, user.id));
      if (existing.length > 0) {
        throw new Error("User already belongs to an organization");
      }
      await assertSeatAvailableForRole(memberData.organizationId, memberData.role);
      return { data: memberData };
    },
    beforeCreateInvitation: async ({ invitation, inviter }) => {
      // Belt + braces on the email-verification gate: even if a session ever
      // reaches this endpoint without a verified address (rollback of the
      // global flag, future auth path, manually created user), refuse to mail
      // strangers from our verified domain.
      if (!inviter.emailVerified) {
        throw new Error("Verify your email before inviting others");
      }
      // Surface the seat limit at invite time so the inviter gets immediate feedback.
      // Seats are only truly reserved at acceptance (beforeAcceptInvitation), so this
      // is best-effort UX: it blocks the obvious over-invite, not concurrent pending ones.
      await assertSeatAvailableForRole(invitation.organizationId, invitation.role);
    },
    beforeUpdateMemberRole: async ({ member: memberData, newRole, organization: org }) => {
      // Only a promotion from an unseated role into a seat consumes a new seat; a
      // seated→seated change (e.g. admin→owner) or any demotion is always allowed.
      if (isSeatedRole(newRole) && !isSeatedRole(memberData.role)) {
        await assertSeatAvailableForRole(org.id, newRole);
      }
    },
    beforeUpdateOrganization: async ({ organization: org, member: memberData }) => {
      if ("name" in org && typeof org.name === "string") {
        // Re-apply the same sanitization on rename so an attacker can't slip a
        // phishing payload past us by editing after creation.
        const cleanName = sanitizeOrgName(org.name);
        if (cleanName !== org.name) {
          (org as { name: string }).name = cleanName;
        }
      }
      if (!("slug" in org) || org.slug === undefined) return;
      const plan = await orgPlanFor(memberData.organizationId);
      if (plan === "free") {
        throw new Error("Custom subdomain requires Team plan");
      }
    },
    beforeAcceptInvitation: async ({ user, invitation, organization: org }) => {
      const existing = await db.select().from(member).where(eq(member.userId, user.id));
      if (existing.length > 0) {
        throw new Error("Already in an organization");
      }
      // Seats are not reserved at invite time, so re-check at acceptance.
      await assertSeatAvailableForRole(org.id, invitation.role ?? "member");
    },
  },
  // Total membership is uncapped: manager/viewer are unlimited on every plan. Seats
  // (owner/admin) are enforced per-role in the add/accept/promote hooks above.
  membershipLimit: () => Number.MAX_SAFE_INTEGER,
  sendInvitationEmail: async (data) => {
    const inviteLink = `${WEB_URL}/invite/${data.id}`;
    await sendInviteEmail({
      orgId: data.organization.id,
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
      use: [
        checkout({
          products: [
            ...(teamProductId ? [{ productId: teamProductId, slug: "team" }] : []),
            ...(TEAM_PRODUCT_ANNUAL_ID
              ? [{ productId: TEAM_PRODUCT_ANNUAL_ID, slug: "team-annual" }]
              : []),
            ...broadcastTierCheckoutProducts(),
          ],
          successUrl: `${WEB_URL}/admin?tab=billing&success=1`,
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

const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
const captchaPlugin = turnstileSecret
  ? captcha({
      provider: "cloudflare-turnstile",
      secretKey: turnstileSecret,
      // Defaults cover /sign-up/email, /sign-in/email, /request-password-reset.
      // Plugin reads token from the x-captcha-response header on these endpoints
      // and rejects with 403 on missing/invalid.
    })
  : null;

const authPlugins = [
  organizationPlugin,
  twoFactor(),
  passkey({
    rpID: passkeyRpId(),
    rpName: Bun.env.VITE_BUSINESS_NAME ?? Bun.env.BUSINESS_NAME ?? "BuchingMate",
  }),
  ...(captchaPlugin ? [captchaPlugin] : []),
  ...(polarPlugin ? [polarPlugin] : []),
];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  appName: Bun.env.VITE_BUSINESS_NAME ?? Bun.env.BUSINESS_NAME ?? "BuchingMate",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  trustedOrigins: TRUSTED_ORIGINS,
  emailAndPassword: {
    enabled: true,
    // Without this flag, a fresh account can sign in immediately and reach the
    // invite endpoint — same primitive the Kaneo phishing attack used. Pair
    // with the inviter.emailVerified check in beforeCreateInvitation.
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerifyEmail({ email: user.email, verifyLink: url });
    },
  },
  socialProviders: googleProvider,
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isEmailDomainAllowed(user.email)) {
            throw new Error(
              `Email domain not allowed. Permitted: ${allowedEmailDomains.join(", ")}`,
            );
          }
          if (isDisposableEmail(user.email)) {
            throw new Error("Please use a permanent email address");
          }
          return { data: user };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const rows = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
            .limit(1);
          const email = rows[0]?.email;
          if (email && !isEmailDomainAllowed(email)) {
            throw new Error("Sign-in not allowed for this email domain");
          }
          return { data: session };
        },
      },
    },
  },
  plugins: authPlugins,
  ...(process.env.COOKIE_DOMAIN
    ? {
        advanced: {
          defaultCookieAttributes: {
            domain: process.env.COOKIE_DOMAIN,
            sameSite: "lax" as const,
            secure: true,
          },
        },
      }
    : {}),
});
