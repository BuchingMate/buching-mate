import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { orgEmailDomains, organization, orgSettings } from "../../db/schema";
import { getLogger } from "../../observability/request-context";
import { getEmailTransport, type EmailAttachment, type OutgoingEmail } from "./transport";

// Service layer for outgoing email. Owns the business rules — who a message
// is from, whether an org may send at all, and that a failed email never
// breaks the calling flow. Actual delivery goes through the EmailTransport
// picked in transport.ts (Resend, Mailpit, or log), so providers can be
// swapped without touching this file's callers.

// Re-exported for the domain-verification flow, which talks to Resend's
// domain API directly and has no provider-agnostic shape.
export { getResendClient } from "./transport";

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

export type TenantEmailAttachment = EmailAttachment;

// Categorises every tenant-triggered send. Surfaces as a provider tag so the
// webhook can attribute bounces/complaints to a specific surface (e.g. invite
// vs broadcast) when triaging a reputation issue. Values are ASCII
// alphanumerics + "-" so they satisfy Resend's tag-value constraints.
export type TenantEmailKind =
  | "invite"
  | "review-requested"
  | "review-approved"
  | "review-rejected"
  | "booking-resume"
  | "booking-confirmed"
  | "event-cancelled"
  | "event-reminder"
  | "broadcast";

export interface SendTenantEmailInput {
  orgId: string;
  kind: TenantEmailKind;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: TenantEmailAttachment[];
}

// Check the auto-suspend flag set by the Resend webhook handler when an org's
// complaint rate crosses threshold. Refuse to send until an operator clears
// the flag (see docs/internal/security.md).
async function isSendingSuspended(orgId: string): Promise<boolean> {
  const rows = await db
    .select({ suspended: orgSettings.sendingSuspended })
    .from(orgSettings)
    .where(eq(orgSettings.orgId, orgId))
    .limit(1);
  return Boolean(rows[0]?.suspended);
}

// Batched suspension lookup for loops. Returns the subset of orgIds that have
// sending suspended. Use this before iterating to avoid an N+1 SELECT pattern.
export async function getSuspendedOrgIds(orgIds: string[]): Promise<Set<string>> {
  if (orgIds.length === 0) return new Set();
  const rows = await db
    .select({ orgId: orgSettings.orgId })
    .from(orgSettings)
    .where(and(inArray(orgSettings.orgId, orgIds), eq(orgSettings.sendingSuspended, true)));
  return new Set(rows.map((r) => r.orgId));
}

// Send one transactional email for an org. Resolves the org's sender, then
// hands off to the transport. Send errors are logged, not thrown, so a failed
// email never breaks the caller's flow.
export async function sendTenantEmail(input: SendTenantEmailInput): Promise<void> {
  if (await isSendingSuspended(input.orgId)) {
    getLogger().warn(
      { orgId: input.orgId, kind: input.kind, to: input.to },
      "tenant email blocked: sending suspended",
    );
    return;
  }

  const sender = await resolveSender(input.orgId);
  try {
    await getEmailTransport().send({
      from: sender.from,
      to: input.to,
      replyTo: sender.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
      // Carried into the provider webhook payload so the handler can attribute
      // bounces/complaints to the originating org + surface.
      tags: [
        { name: "org_id", value: input.orgId },
        { name: "kind", value: input.kind },
      ],
    });
  } catch (err) {
    getLogger().warn({ err, orgId: input.orgId, to: input.to }, "tenant email send failed");
  }
}

export interface SendPlatformEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Send one email from the platform itself, with no org sender. Used for system
// mail that has no org context, such as attendee sign-in links.
export async function sendPlatformEmail(input: SendPlatformEmailInput): Promise<void> {
  try {
    await getEmailTransport().send({
      from: process.env.RESEND_FROM_EMAIL || "dev@localhost",
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (err) {
    getLogger().warn({ err, to: input.to }, "platform email send failed");
  }
}

export interface BroadcastSendResult {
  sent: string[];
  failed: string[];
}

// Send the same email to many recipients for an org. Resolves the org sender
// once, then hands the batch to the transport. Returns which addresses went
// out and which failed, so the caller can record per-recipient status and
// meter only real sends.
export async function sendBroadcastEmails(input: {
  orgId: string;
  recipients: string[];
  subject: string;
  html: string;
}): Promise<BroadcastSendResult> {
  if (await isSendingSuspended(input.orgId)) {
    getLogger().warn(
      { orgId: input.orgId, count: input.recipients.length },
      "broadcast blocked: sending suspended",
    );
    return { sent: [], failed: [...input.recipients] };
  }

  const sender = await resolveSender(input.orgId);
  const emails: OutgoingEmail[] = input.recipients.map((to) => ({
    from: sender.from,
    to,
    replyTo: sender.replyTo,
    subject: input.subject,
    html: input.html,
    tags: [
      { name: "org_id", value: input.orgId },
      { name: "kind", value: "broadcast" },
    ],
  }));

  const result = await getEmailTransport().sendBatch(emails);
  return { sent: result.sent.map((e) => e.to), failed: result.failed.map((e) => e.to) };
}

// Make a display name safe for an email header. First strip quotes, backslashes,
// and line breaks, then quote the cleaned name when it still holds characters
// that an unquoted header word may not contain.
function formatDisplayName(name: string): string {
  const clean = name.replace(/["\\\r\n]/g, "").trim();
  if (!clean) return "";
  return /[,;:<>@.]/.test(clean) ? `"${clean}"` : clean;
}
