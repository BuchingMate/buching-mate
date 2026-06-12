import { sendPlatformEmail, sendTenantEmail } from "../services/email/mailer";
import {
  emailButton,
  escapeHtml,
  loadTenantBrand,
  PLATFORM_BRAND,
  renderEmailShell,
  renderEmailText,
} from "../services/email/shell";

export async function sendInviteEmail({
  orgId,
  email,
  organizationName,
  inviteLink,
}: {
  orgId: string;
  email: string;
  organizationName: string;
  inviteLink: string;
}) {
  const brand = await loadTenantBrand(orgId);
  const body = `
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">
                  You're invited to join ${escapeHtml(organizationName)}
                </h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Accept your invitation to start managing events, attendees, and bookings together.
                </p>
                ${emailButton(inviteLink, "Accept invitation")}
                <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Or paste this link into your browser:<br/>
                  <span style="color:#475569;word-break:break-all;">${escapeHtml(inviteLink)}</span>
                </p>`;
  await sendTenantEmail({
    orgId,
    kind: "invite",
    to: email,
    subject: `You've been invited to join ${organizationName}`,
    html: renderEmailShell({
      brand,
      preheader: `Accept your invitation to join ${organizationName}.`,
      bodyHtml: body,
      footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;">If you didn't expect this invite, you can safely ignore this email.</p>`,
    }),
    text: renderEmailText(
      [
        `You're invited to join ${organizationName}.`,
        "Accept your invitation to start managing events, attendees, and bookings together:",
        "",
        inviteLink,
        "",
        "If you didn't expect this invite, you can safely ignore this email.",
      ],
      brand,
    ),
  });
}

export async function sendVerifyEmail({
  email,
  verifyLink,
}: {
  email: string;
  verifyLink: string;
}) {
  const body = `
                <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#0f172a;">
                  Verify your email
                </h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:#475569;">
                  Confirm this address so you can sign in and start inviting your team.
                </p>
                ${emailButton(verifyLink, "Verify email")}
                <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Or paste this link into your browser:<br/>
                  <span style="color:#475569;word-break:break-all;">${escapeHtml(verifyLink)}</span>
                </p>`;
  await sendPlatformEmail({
    to: email,
    subject: "Verify your email",
    html: renderEmailShell({
      brand: PLATFORM_BRAND,
      preheader: "Confirm your email address to finish setting up your account.",
      bodyHtml: body,
      footerHtml: `<p style="margin:0;font-size:12px;color:#94a3b8;">If you didn't create an account, you can safely ignore this email.</p>`,
    }),
    text: renderEmailText(
      [
        "Verify your email",
        "",
        "Confirm this address so you can sign in and start inviting your team:",
        "",
        verifyLink,
        "",
        "If you didn't create an account, you can safely ignore this email.",
      ],
      PLATFORM_BRAND,
    ),
  });
}
