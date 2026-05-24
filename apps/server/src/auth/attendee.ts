import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "../db";
import { attendeeSession, attendeeUser, attendeeVerification } from "../db/auth-schema";
import { BETTER_AUTH_URL, TRUSTED_ORIGINS } from "../env";
import { sendPlatformEmail } from "../services/email/mailer";

// The attendee sign-in link has no org context, so it is sent from the platform.
async function sendAttendeeMagicLink({ email, url }: { email: string; url: string }) {
  await sendPlatformEmail({
    to: email,
    subject: "Your sign-in link",
    html: renderMagicLinkHtml(url),
  });
}

function renderMagicLinkHtml(url: string) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;">Sign in</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Click the button below to sign in. This link expires in 10 minutes.
                </p>
                <a href="${url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:500;">
                  Sign in
                </a>
                <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Or paste this link into your browser:<br/>
                  <span style="color:#475569;word-break:break-all;">${url}</span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export const attendeeAuth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: attendeeUser,
      session: attendeeSession,
      verification: attendeeVerification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  basePath: "/api/public/auth",
  trustedOrigins: TRUSTED_ORIGINS,
  advanced: {
    cookiePrefix: "bm-attendee",
  },
  emailAndPassword: { enabled: false },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendAttendeeMagicLink({ email, url });
      },
    }),
  ],
});
