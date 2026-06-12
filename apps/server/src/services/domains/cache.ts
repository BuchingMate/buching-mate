import { eq } from "drizzle-orm";
import { db } from "../../db";
import { organization, orgCustomDomains } from "../../db/schema";

// In-memory map of active custom hostnames, used on the CORS hot path and the
// public domain-resolve endpoint. Refreshed at most once per TTL; create/verify/
// remove call invalidate() so single-process changes apply immediately.
const TTL_MS = 60_000;

interface HostEntry {
  orgId: string;
  slug: string | null;
}

let hosts = new Map<string, HostEntry>();
let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function reload(): Promise<void> {
  const rows = await db
    .select({
      hostname: orgCustomDomains.hostname,
      orgId: orgCustomDomains.orgId,
      slug: organization.slug,
    })
    .from(orgCustomDomains)
    .innerJoin(organization, eq(orgCustomDomains.orgId, organization.id))
    .where(eq(orgCustomDomains.status, "active"));
  hosts = new Map(rows.map((r) => [r.hostname, { orgId: r.orgId, slug: r.slug }]));
  loadedAt = Date.now();
}

export async function ensureFreshDomainCache(): Promise<void> {
  if (Date.now() - loadedAt < TTL_MS) return;
  if (!inflight) {
    inflight = reload().finally(() => {
      inflight = null;
    });
  }
  await inflight;
}

export function lookupCustomDomainHost(hostname: string): HostEntry | null {
  return hosts.get(hostname) ?? null;
}

export function invalidateDomainCache(): void {
  loadedAt = 0;
}
