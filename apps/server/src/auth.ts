import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";
import { member } from "./db/schema";
import { ac, owner, admin, manager, viewer } from "./auth/permissions";
import { sendInviteEmail } from "./auth/email";

const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

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
    beforeAcceptInvitation: async ({ user }) => {
      const existing = await db.select().from(member).where(eq(member.userId, user.id));
      if (existing.length > 0) {
        throw new Error("Already in an organization");
      }
    },
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
  plugins: [organizationPlugin],
});
