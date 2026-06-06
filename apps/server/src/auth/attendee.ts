import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "../db";
import { attendeeSession, attendeeUser, attendeeVerification } from "../db/auth-schema";
import { BETTER_AUTH_URL, TRUSTED_ORIGINS } from "../env";
import { BUSINESS_NAME } from "../branding";
import { sendPlatformEmail } from "../services/email/mailer";

// The attendee sign-in link has no org context, so it is sent from the platform.
async function sendAttendeeMagicLink({ email, url }: { email: string; url: string }) {
  const rendered = renderMagicLinkEmail(url);
  await sendPlatformEmail({
    to: email,
    subject: `Sign in to ${BUSINESS_NAME}`,
    html: rendered.html,
    text: rendered.text,
  });
}

// Exported for tests: pure render, no I/O.
export function renderMagicLinkEmail(url: string): { html: string; text: string } {
  const preheader = "Your secure sign-in link — expires in 10 minutes.";
  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <p style="margin:0 0 16px 0;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;">${BUSINESS_NAME}</p>
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;">Sign in to your bookings</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Use the button below to view and manage your event bookings. No password needed — this link signs you in directly and expires in <strong>10 minutes</strong>.
                </p>
                <a href="${url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">
                  Sign in
                </a>
                <p style="margin:24px 0 24px 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Or paste this link into your browser:<br/>
                  <span style="color:#475569;word-break:break-all;">${url}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Didn't request this? You can safely ignore this email — the link only works from this message and expires on its own.
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

  const text = [
    `Sign in to ${BUSINESS_NAME}`,
    "",
    "Use the link below to view and manage your event bookings.",
    "No password needed — it signs you in directly and expires in 10 minutes.",
    "",
    url,
    "",
    "Didn't request this? You can safely ignore this email.",
  ].join("\n");

  return { html, text };
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
