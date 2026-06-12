import type { CustomDomainDto, EmailDnsRecord } from "@workspace/contracts";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { organization, orgCustomDomains } from "../../db/schema";
import { customDomainsEnabled, env, PUBLIC_SITE_URL, SERVER_URL, WEB_URL } from "../../env";
import { getLogger } from "../../observability/request-context";
import {
  cfCreateCustomHostname,
  cfDeleteCustomHostname,
  cfGetCustomHostname,
  type CfCustomHostname,
} from "./cloudflare";
import { invalidateDomainCache } from "./cache";

export { ensureFreshDomainCache, invalidateDomainCache, lookupCustomDomainHost } from "./cache";

type CustomDomainRow = typeof orgCustomDomains.$inferSelect;

const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// Strip scheme/port/path noise and lowercase. Returns null when the result is
// not a plausible hostname.
export function normalizeHostname(input: string): string | null {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split("/")[0].split(":")[0];
  value = value.replace(/\.$/, "");
  if (!HOSTNAME_PATTERN.test(value)) return null;
  return value;
}

// The platform's own hostnames (and their subdomains) can never be claimed as
// a customer domain — that would hijack main-domain or API traffic.
export function isPlatformHostname(hostname: string): boolean {
  const platformHosts = new Set<string>();
  for (const url of [WEB_URL, PUBLIC_SITE_URL, SERVER_URL]) {
    try {
      platformHosts.add(new URL(url).hostname);
    } catch {
      // ignore unparsable env URLs
    }
  }
  for (const platformHost of platformHosts) {
    if (hostname === platformHost || hostname.endsWith(`.${platformHost}`)) return true;
  }
  return false;
}

// Cloudflare custom hostname statuses collapse to our five-state status. The
// domain only counts as active once both the hostname and its certificate are.
export function mapCustomHostnameStatus(cf: CfCustomHostname): CustomDomainDto["status"] {
  const hostStatus = cf.status ?? "pending";
  const sslStatus = cf.ssl?.status ?? "pending";
  if (hostStatus === "active" && sslStatus === "active") return "active";
  if (
    hostStatus === "deleted" ||
    hostStatus === "blocked" ||
    hostStatus.endsWith("_timed_out") ||
    sslStatus.endsWith("_timed_out")
  ) {
    return "failed";
  }
  if (hostStatus === "pending" && !cf.ownership_verification && !cf.ssl) return "pending";
  return "verifying";
}

// DNS records the customer must publish: the routing CNAME plus any Cloudflare
// ownership/certificate-validation TXT records.
export function buildDnsRecords(hostname: string, cf: CfCustomHostname | null): EmailDnsRecord[] {
  const records: EmailDnsRecord[] = [
    {
      record: "routing",
      name: hostname,
      type: "CNAME",
      value: env.CF_SAAS_CNAME_TARGET ?? "your-platform-hostname",
    },
  ];
  const ownership = cf?.ownership_verification;
  if (ownership?.name && ownership.value) {
    records.push({
      record: "ownership",
      name: ownership.name,
      type: ownership.type?.toUpperCase() ?? "TXT",
      value: ownership.value,
    });
  }
  for (const validation of cf?.ssl?.validation_records ?? []) {
    if (validation.txt_name && validation.txt_value) {
      records.push({
        record: "certificate",
        name: validation.txt_name,
        type: "TXT",
        value: validation.txt_value,
      });
    }
  }
  return records;
}

function toDto(row: CustomDomainRow): CustomDomainDto {
  return {
    hostname: row.hostname,
    status: row.status,
    dnsRecords: row.dnsRecords,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function devModeAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function getCustomDomain(orgId: string): Promise<CustomDomainDto | null> {
  const rows = await db
    .select()
    .from(orgCustomDomains)
    .where(eq(orgCustomDomains.orgId, orgId))
    .limit(1);
  const row = rows[0];
  return row ? toDto(row) : null;
}

// Register a custom booking domain for an org. Replaces any existing domain row
// for the org. Throws "invalid_hostname", "hostname_taken", or
// "custom_domains_unavailable".
export async function createCustomDomain(orgId: string, input: string): Promise<CustomDomainDto> {
  const hostname = normalizeHostname(input);
  if (!hostname || isPlatformHostname(hostname)) throw new Error("invalid_hostname");

  let cloudflareHostnameId: string | null = null;
  let status: CustomDomainDto["status"];
  let dnsRecords: EmailDnsRecord[];

  if (customDomainsEnabled) {
    const cf = await cfCreateCustomHostname(hostname);
    cloudflareHostnameId = cf.id;
    status = mapCustomHostnameStatus(cf);
    dnsRecords = buildDnsRecords(hostname, cf);
  } else if (devModeAllowed()) {
    // Local dev without Cloudflare: mark the domain active immediately so
    // lvh.me-style hosts can simulate a customer domain end to end.
    getLogger().warn({ orgId, hostname }, "custom domain created in dev mode (no Cloudflare env)");
    status = "active";
    dnsRecords = buildDnsRecords(hostname, null);
  } else {
    throw new Error("custom_domains_unavailable");
  }

  const now = new Date();
  try {
    const [row] = await db
      .insert(orgCustomDomains)
      .values({
        orgId,
        hostname,
        cloudflareHostnameId,
        status,
        dnsRecords,
        lastCheckedAt: now,
        verifiedAt: status === "active" ? now : null,
      })
      .onConflictDoUpdate({
        target: orgCustomDomains.orgId,
        set: {
          hostname,
          cloudflareHostnameId,
          status,
          dnsRecords,
          lastCheckedAt: now,
          verifiedAt: status === "active" ? now : null,
          updatedAt: now,
        },
      })
      .returning();
    invalidateDomainCache();
    return toDto(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error("hostname_taken");
    throw err;
  }
}

// Re-check provisioning state with Cloudflare and store the latest status and
// records. Called when the org clicks "Verify" / "Refresh".
export async function verifyCustomDomain(orgId: string): Promise<CustomDomainDto | null> {
  const rows = await db
    .select()
    .from(orgCustomDomains)
    .where(eq(orgCustomDomains.orgId, orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (!row.cloudflareHostnameId || !customDomainsEnabled) {
    // Dev-mode row (or CF since disabled): nothing to check remotely.
    return toDto(row);
  }

  const cf = await cfGetCustomHostname(row.cloudflareHostnameId);
  const status = mapCustomHostnameStatus(cf);
  const dnsRecords = buildDnsRecords(row.hostname, cf);
  const now = new Date();

  const [updated] = await db
    .update(orgCustomDomains)
    .set({
      status,
      dnsRecords,
      lastCheckedAt: now,
      verifiedAt: status === "active" ? (row.verifiedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(orgCustomDomains.orgId, orgId))
    .returning();

  invalidateDomainCache();
  return toDto(updated);
}

// Remove an org's custom domain from Cloudflare (best-effort) and our database.
export async function removeCustomDomain(orgId: string): Promise<void> {
  const rows = await db
    .select({ cloudflareHostnameId: orgCustomDomains.cloudflareHostnameId })
    .from(orgCustomDomains)
    .where(eq(orgCustomDomains.orgId, orgId))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  if (row.cloudflareHostnameId && customDomainsEnabled) {
    try {
      await cfDeleteCustomHostname(row.cloudflareHostnameId);
    } catch (err) {
      getLogger().warn({ err, orgId }, "cloudflare custom hostname delete failed");
    }
  }
  await db.delete(orgCustomDomains).where(eq(orgCustomDomains.orgId, orgId));
  invalidateDomainCache();
}

// Look up the org served by an active custom domain. Used by the public
// domain-resolve endpoint; goes to the database (not the cache) so callers that
// need authoritative reads get them.
export async function resolveOrgByHostname(
  hostname: string,
): Promise<{ orgId: string; slug: string | null } | null> {
  const rows = await db
    .select({ orgId: orgCustomDomains.orgId, slug: organization.slug })
    .from(orgCustomDomains)
    .innerJoin(organization, eq(orgCustomDomains.orgId, organization.id))
    .where(and(eq(orgCustomDomains.hostname, hostname), eq(orgCustomDomains.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

// Browser origin for a custom hostname. Custom domains are HTTPS in real
// deployments; in local dev (http WEB_URL) mirror the dev scheme and port so
// hosts like customer.lvh.me:5678 work.
export function originForHostname(hostname: string): string {
  const base = new URL(WEB_URL);
  if (base.protocol === "http:") {
    const port = base.port ? `:${base.port}` : "";
    return `http://${hostname}${port}`;
  }
  return `https://${hostname}`;
}

// Where an org's public event pages live: its active custom domain if it has
// one, otherwise the main public site.
export async function publicOriginForOrg(orgId: string): Promise<string> {
  const rows = await db
    .select({ hostname: orgCustomDomains.hostname })
    .from(orgCustomDomains)
    .where(and(eq(orgCustomDomains.orgId, orgId), eq(orgCustomDomains.status, "active")))
    .limit(1);
  const row = rows[0];
  return row ? originForHostname(row.hostname) : PUBLIC_SITE_URL;
}

// Active custom-domain origin or null — for callers that need to distinguish
// "has own domain" from "lives on the main site".
export async function customDomainOriginForOrg(orgId: string): Promise<string | null> {
  const rows = await db
    .select({ hostname: orgCustomDomains.hostname })
    .from(orgCustomDomains)
    .where(and(eq(orgCustomDomains.orgId, orgId), eq(orgCustomDomains.status, "active")))
    .limit(1);
  const row = rows[0];
  return row ? originForHostname(row.hostname) : null;
}
