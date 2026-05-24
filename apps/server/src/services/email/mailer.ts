import { and, eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../../db";
import { orgEmailDomains, organization, orgSettings } from "../../db/schema";
import { getLogger } from "../../observability/request-context";

let client: Resend | null = null;

// Shared Resend client. Returns null when Resend is not configured (local dev).
export function getResendClient(): Resend | null {
  if (!client && process.env.RESEND_API_KEY) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

// True when Resend is set up. When false the mailer logs instead of sending,
// which keeps local dev quiet.
function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export interface TenantSender {
  from: string;
  replyTo?: string;
}

// Pick the address mail is sent from. Use the org's own verified domain when it
// has one; otherwise fall back to the platform address. Pure, so it is easy to
// test.
export function senderAddress(opts: {
  verifiedDomain: string | null;
  platformAddress: string;
}): string {
  return opts.verifiedDomain ? `noreply@${opts.verifiedDomain}` : opts.platformAddress;
}

// Build the From and Reply-To from an org's name and address. Pure, so it can be
// tested without a database. The From shows the org name over the address; the
// Reply-To is the org's own contact so replies reach the org.
export function buildSender(opts: {
  orgName: string | null;
  contactEmail: string | null;
  address: string;
}): TenantSender {
  const displayName = formatDisplayName(opts.orgName ?? "");
  const from = displayName ? `${displayName} <${opts.address}>` : opts.address;
  return { from, replyTo: opts.contactEmail ?? undefined };
}

// Read an org's name, contact email, and verified sending domain, then build its
// sender. Mail goes from the org's own domain once that domain is active, else
// from the platform address with the org name shown.
export async function resolveSender(orgId: string): Promise<TenantSender> {
  const rows = await db
    .select({
      name: organization.name,
      contactEmail: orgSettings.contactEmail,
      verifiedDomain: orgEmailDomains.domain,
    })
    .from(organization)
    .leftJoin(orgSettings, eq(orgSettings.orgId, organization.id))
    .leftJoin(
      orgEmailDomains,
      and(eq(orgEmailDomains.orgId, organization.id), eq(orgEmailDomains.status, "active")),
    )
    .where(eq(organization.id, orgId))
    .limit(1);

  const row = rows[0];
  const address = senderAddress({
    verifiedDomain: row?.verifiedDomain ?? null,
    platformAddress: process.env.RESEND_FROM_EMAIL ?? "",
  });
  return buildSender({
    orgName: row?.name ?? null,
    contactEmail: row?.contactEmail ?? null,
    address,
  });
}

export interface TenantEmailAttachment {
  filename: string;
  contentType: string;
  content: string;
}

export interface SendTenantEmailInput {
  orgId: string;
  to: string;
  subject: string;
  html: string;
  attachments?: TenantEmailAttachment[];
}

// Send one transactional email for an org. Resolves the org's sender, then
// hands off to Resend. Send errors are logged, not thrown, so a failed email
// never breaks the caller's flow.
export async function sendTenantEmail(input: SendTenantEmailInput): Promise<void> {
  if (!isConfigured()) {
    getLogger().info(
      { orgId: input.orgId, to: input.to, subject: input.subject },
      "dev tenant email",
    );
    return;
  }

  const sender = await resolveSender(input.orgId);
  try {
    await getResendClient()?.emails.send({
      from: sender.from,
      to: input.to,
      ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
  } catch (err) {
    getLogger().warn({ err, orgId: input.orgId, to: input.to }, "tenant email send failed");
  }
}

export interface SendPlatformEmailInput {
  to: string;
  subject: string;
  html: string;
}

// Send one email from the platform itself, with no org sender. Used for system
// mail that has no org context, such as attendee sign-in links.
export async function sendPlatformEmail(input: SendPlatformEmailInput): Promise<void> {
  if (!isConfigured()) {
    getLogger().info({ to: input.to, subject: input.subject }, "dev platform email");
    return;
  }
  try {
    await getResendClient()?.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  } catch (err) {
    getLogger().warn({ err, to: input.to }, "platform email send failed");
  }
}

export interface BroadcastSendResult {
  sent: string[];
  failed: string[];
}

// Resend allows up to 100 messages per batch.
const BATCH_LIMIT = 100;

// Send the same email to many recipients for an org. Resolves the org sender
// once, then sends in batches of 100. Returns which addresses went out and which
// failed, so the caller can record per-recipient status and meter only real sends.
export async function sendBroadcastEmails(input: {
  orgId: string;
  recipients: string[];
  subject: string;
  html: string;
}): Promise<BroadcastSendResult> {
  if (!isConfigured()) {
    getLogger().info(
      { orgId: input.orgId, count: input.recipients.length, subject: input.subject },
      "dev broadcast email",
    );
    return { sent: [...input.recipients], failed: [] };
  }

  const client = getResendClient();
  if (!client) return { sent: [], failed: [...input.recipients] };

  const sender = await resolveSender(input.orgId);
  const sent: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < input.recipients.length; i += BATCH_LIMIT) {
    const chunk = input.recipients.slice(i, i + BATCH_LIMIT);
    try {
      const { error } = await client.batch.send(
        chunk.map((to) => ({
          from: sender.from,
          to,
          ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
          subject: input.subject,
          html: input.html,
        })),
      );
      if (error) {
        failed.push(...chunk);
        getLogger().warn({ err: error, orgId: input.orgId }, "broadcast batch send failed");
      } else {
        sent.push(...chunk);
      }
    } catch (err) {
      failed.push(...chunk);
      getLogger().warn({ err, orgId: input.orgId }, "broadcast batch send threw");
    }
  }

  return { sent, failed };
}

// Make a display name safe for an email header. First strip quotes, backslashes,
// and line breaks, then quote the cleaned name when it still holds characters
// that an unquoted header word may not contain.
function formatDisplayName(name: string): string {
  const clean = name.replace(/["\\\r\n]/g, "").trim();
  if (!clean) return "";
  return /[,;:<>@.]/.test(clean) ? `"${clean}"` : clean;
}
