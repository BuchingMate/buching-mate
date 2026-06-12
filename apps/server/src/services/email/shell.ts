import { eq } from "drizzle-orm";
import { brandingAccent } from "@workspace/contracts";
import { db } from "../../db";
import { organization, orgSettings } from "../../db/schema";
import { BUSINESS_NAME } from "../../branding";

// Shared shell for every transactional email. One place owns the visual frame
// (preheader, masthead, card, footer) so all surfaces look like they come from
// the same product, while each template only supplies its body and footer
// content. Pure render — branding is loaded separately so templates stay
// testable without a database.

export interface EmailBrand {
  // Org name for tenant mail, or the platform name for platform mail.
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
}

// The platform's own brand, used by emails with no org context (sign-in,
// verification).
export const PLATFORM_BRAND: EmailBrand = {
  name: BUSINESS_NAME,
  logoUrl: null,
  accentColor: null,
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailButton(href: string, label: string, background = "#0f172a"): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${background};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(label)}</a>`;
}

export interface EmailShellInput {
  brand: EmailBrand;
  // Shown by inbox list views next to the subject; invisible in the body.
  preheader?: string | null;
  bodyHtml: string;
  // Template-specific footer content (links, disclaimers). The sender
  // signature line is appended automatically.
  footerHtml?: string | null;
}

// Bottom line of every email: tells the recipient who sent it and through
// what. Tenant mail names the org; platform mail names only the platform.
function signatureText(brand: EmailBrand): string {
  return brand.name && brand.name !== BUSINESS_NAME
    ? `Sent by ${brand.name} via ${BUSINESS_NAME}`
    : BUSINESS_NAME;
}

export function renderEmailShell(input: EmailShellInput): string {
  const accent = brandingAccent(input.brand.accentColor);
  const masthead = input.brand.logoUrl
    ? `<img src="${escapeHtml(input.brand.logoUrl)}" alt="${escapeHtml(input.brand.name)}" style="max-height:32px;display:block;" />`
    : `<span style="font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(input.brand.name)}</span>`;
  const preheaderDiv = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>`
    : "";
  const footerBlock = input.footerHtml
    ? `<div style="margin:0 0 8px 0;">${input.footerHtml}</div>`
    : "";

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    ${preheaderDiv}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr><td style="height:4px;background:${accent};"></td></tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">${masthead}</td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                ${footerBlock}
                <p style="margin:0;font-size:11px;color:#cbd5e1;">${escapeHtml(signatureText(input.brand))}</p>
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

// Join plain-text lines, dropping falsy entries, and close with the sender
// signature so every text part mirrors the HTML footer.
export function renderEmailText(
  lines: Array<string | null | undefined | false>,
  brand: EmailBrand,
): string {
  return [
    ...lines.filter((line): line is string => typeof line === "string"),
    "",
    signatureText(brand),
  ].join("\n");
}

// Load the brand an org's mail is wrapped in. Branding lives in the
// org_settings.email_templates jsonb (same source the broadcast composer
// uses), so transactional mail picks up the org's logo and accent for free.
export async function loadTenantBrand(orgId: string): Promise<EmailBrand> {
  const rows = await db
    .select({ name: organization.name, templates: orgSettings.emailTemplates })
    .from(organization)
    .leftJoin(orgSettings, eq(orgSettings.orgId, organization.id))
    .where(eq(organization.id, orgId))
    .limit(1);
  const templates = (rows[0]?.templates ?? {}) as Record<string, unknown>;
  return {
    name: rows[0]?.name ?? BUSINESS_NAME,
    logoUrl: typeof templates.logoUrl === "string" ? templates.logoUrl : null,
    accentColor: typeof templates.accentColor === "string" ? templates.accentColor : null,
  };
}
