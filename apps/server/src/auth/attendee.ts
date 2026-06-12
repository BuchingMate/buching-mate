import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "../db";
import { attendeeSession, attendeeUser, attendeeVerification } from "../db/auth-schema";
import { BETTER_AUTH_URL, TRUSTED_ORIGINS } from "../env";
import { BUSINESS_NAME } from "../branding";
import { sendPlatformEmail } from "../services/email/mailer";
import {
  emailButton,
  escapeHtml,
  PLATFORM_BRAND,
  renderEmailShell,
  renderEmailText,
} from "../services/email/shell";

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
  const body = `
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">Sign in to your bookings</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Use the button below to view and manage your event bookings. No password needed — this link signs you in directly and expires in <strong>10 minutes</strong>.
                </p>
                ${emailButton(url, "Sign in")}
                <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Or paste this link into your browser:<br/>
                  <span style="color:#475569;word-break:break-all;">${escapeHtml(url)}</span>
                </p>`;
  const html = renderEmailShell({
    brand: PLATFORM_BRAND,
    preheader: "Your secure sign-in link — expires in 10 minutes.",
    bodyHtml: body,
    footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">Didn't request this? You can safely ignore this email — the link only works from this message and expires on its own.</p>`,
  });

  const text = renderEmailText(
    [
      `Sign in to ${BUSINESS_NAME}`,
      "",
      "Use the link below to view and manage your event bookings.",
      "No password needed — it signs you in directly and expires in 10 minutes.",
      "",
      url,
      "",
      "Didn't request this? You can safely ignore this email.",
    ],
    PLATFORM_BRAND,
  );

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
