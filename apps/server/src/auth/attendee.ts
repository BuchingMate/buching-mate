import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "../db";
import { attendeeSession, attendeeUser, attendeeVerification } from "../db/auth-schema";
import { getLogger } from "../observability/request-context";

let resend: Resend | null = null;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

async function sendAttendeeMagicLink({ email, url }: { email: string; url: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    getLogger().info({ email, url }, "dev attendee magic link");
    return;
  }
  try {
    await getResend()?.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: "Your sign-in link",
      html: renderMagicLinkHtml(url),
    });
  } catch (err) {
    getLogger().warn({ err, email }, "attendee magic link email failed");
  }
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

function buildTrustedOrigins() {
  const webUrl = process.env.WEB_URL || "http://localhost:5678";
  const publicSiteUrl = process.env.PUBLIC_SITE_URL || webUrl;
  const origins = new Set<string>([webUrl, publicSiteUrl]);

  try {
    const parsed = new URL(publicSiteUrl);
    origins.add(`${parsed.protocol}//*.${parsed.host}`);
  } catch {
    // ignore
  }

  // Dev wildcard helpers.
  origins.add("http://*.lvh.me:5678");
  origins.add("http://*.localhost:5678");

  return Array.from(origins);
}

const trustedOrigins = buildTrustedOrigins();

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
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/public/auth",
  trustedOrigins,
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
