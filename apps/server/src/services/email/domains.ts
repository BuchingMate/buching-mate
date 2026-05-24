import type { EmailDnsRecord, EmailDomainDto, EmailDomainStatus } from "@workspace/contracts";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orgEmailDomains } from "../../db/schema";
import { getLogger } from "../../observability/request-context";
import { getResendClient } from "./mailer";

// Shape of a DNS record as the Resend SDK returns it. Only the fields we use.
interface ResendDnsRecord {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

// Turn Resend's domain status into our four-state status. Anything we don't
// recognise is treated as "verifying" so the org keeps waiting rather than
// seeing a false failure.
export function mapDomainStatus(resendStatus: string | null | undefined): EmailDomainStatus {
  switch (resendStatus) {
    case "verified":
      return "active";
    case "not_started":
      return "pending";
    case "failed":
    case "failure":
      return "failed";
    default:
      return "verifying";
  }
}

// Map Resend's DNS records to our shape, dropping anything without the parts an
// org needs to publish.
export function mapDnsRecords(records: ResendDnsRecord[] | null | undefined): EmailDnsRecord[] {
  if (!records) return [];
  return records
    .filter((r) => r.name && r.type && r.value)
    .map((r) => ({
      record: r.record ?? "",
      name: r.name!,
      type: r.type!,
      value: r.value!,
      ttl: r.ttl,
      priority: r.priority,
      status: r.status,
    }));
}

function toDto(row: typeof orgEmailDomains.$inferSelect): EmailDomainDto {
  return {
    domain: row.domain,
    status: row.status,
    dnsRecords: row.dnsRecords,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

// Read an org's custom sending domain, if it has one.
export async function getEmailDomain(orgId: string): Promise<EmailDomainDto | null> {
  const rows = await db
    .select()
    .from(orgEmailDomains)
    .where(eq(orgEmailDomains.orgId, orgId))
    .limit(1);
  const row = rows[0];
  return row ? toDto(row) : null;
}

// Register a domain for an org in our Resend account and store the DNS records
// the org must publish. Replaces any existing domain row for the org.
export async function createEmailDomain(orgId: string, domain: string): Promise<EmailDomainDto> {
  const resend = getResendClient();
  if (!resend) throw new Error("email_provider_unavailable");

  const { data, error } = await resend.domains.create({ name: domain });
  if (error || !data) {
    getLogger().warn({ err: error, orgId, domain }, "resend domain create failed");
    throw new Error("domain_create_failed");
  }

  const dnsRecords = mapDnsRecords(data.records as ResendDnsRecord[] | undefined);
  const status = mapDomainStatus(data.status);
  const now = new Date();

  const [row] = await db
    .insert(orgEmailDomains)
    .values({ orgId, domain, resendDomainId: data.id, status, dnsRecords, lastCheckedAt: now })
    .onConflictDoUpdate({
      target: orgEmailDomains.orgId,
      set: {
        domain,
        resendDomainId: data.id,
        status,
        dnsRecords,
        lastCheckedAt: now,
        verifiedAt: null,
        updatedAt: now,
      },
    })
    .returning();

  return toDto(row);
}

// Ask Resend to check the domain's DNS, then read back the latest status and
// records and store them. Called when the org clicks "Verify".
export async function verifyEmailDomain(orgId: string): Promise<EmailDomainDto | null> {
  const resend = getResendClient();
  if (!resend) throw new Error("email_provider_unavailable");

  const existing = await db
    .select()
    .from(orgEmailDomains)
    .where(eq(orgEmailDomains.orgId, orgId))
    .limit(1);
  const row = existing[0];
  if (!row) return null;

  await resend.domains.verify(row.resendDomainId);

  const { data, error } = await resend.domains.get(row.resendDomainId);
  if (error || !data) {
    getLogger().warn({ err: error, orgId }, "resend domain get failed");
    throw new Error("domain_check_failed");
  }

  const status = mapDomainStatus(data.status);
  const dnsRecords = mapDnsRecords(data.records as ResendDnsRecord[] | undefined);
  const now = new Date();

  const [updated] = await db
    .update(orgEmailDomains)
    .set({
      status,
      dnsRecords,
      lastCheckedAt: now,
      verifiedAt: status === "active" ? (row.verifiedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(orgEmailDomains.orgId, orgId))
    .returning();

  return toDto(updated);
}

// Remove an org's custom sending domain from Resend and our database.
export async function removeEmailDomain(orgId: string): Promise<void> {
  const rows = await db
    .select({ resendDomainId: orgEmailDomains.resendDomainId })
    .from(orgEmailDomains)
    .where(eq(orgEmailDomains.orgId, orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const resend = getResendClient();
  if (resend) {
    try {
      await resend.domains.remove(row.resendDomainId);
    } catch (err) {
      getLogger().warn({ err, orgId }, "resend domain remove failed");
    }
  }
  await db.delete(orgEmailDomains).where(eq(orgEmailDomains.orgId, orgId));
}
