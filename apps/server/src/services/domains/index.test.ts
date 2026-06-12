import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import { PUBLIC_SITE_URL } from "../../env";
import {
  buildDnsRecords,
  createCustomDomain,
  customDomainOriginForOrg,
  getCustomDomain,
  isPlatformHostname,
  mapCustomHostnameStatus,
  normalizeHostname,
  publicOriginForOrg,
  removeCustomDomain,
  resolveOrgByHostname,
} from "./index";
import { ensureFreshDomainCache, invalidateDomainCache, lookupCustomDomainHost } from "./cache";

function host() {
  return `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.example.com`;
}

describe("normalizeHostname", () => {
  test("lowercases and strips scheme, port, path, trailing dot", () => {
    expect(normalizeHostname("HTTPS://Events.Acme.COM:443/events.")).toBe("events.acme.com");
    expect(normalizeHostname("events.acme.com")).toBe("events.acme.com");
  });

  test("rejects garbage", () => {
    expect(normalizeHostname("not a host")).toBeNull();
    expect(normalizeHostname("nodots")).toBeNull();
    expect(normalizeHostname("")).toBeNull();
  });
});

describe("isPlatformHostname", () => {
  test("blocks the platform hosts and their subdomains", () => {
    const webHost = new URL(PUBLIC_SITE_URL).hostname;
    expect(isPlatformHostname(webHost)).toBe(true);
    expect(isPlatformHostname(`anything.${webHost}`)).toBe(true);
  });

  test("allows unrelated hosts", () => {
    expect(isPlatformHostname("events.acme.com")).toBe(false);
  });
});

describe("mapCustomHostnameStatus", () => {
  test("active needs both hostname and ssl active", () => {
    expect(
      mapCustomHostnameStatus({
        id: "x",
        hostname: "h",
        status: "active",
        ssl: { status: "active" },
      }),
    ).toBe("active");
    expect(
      mapCustomHostnameStatus({
        id: "x",
        hostname: "h",
        status: "active",
        ssl: { status: "pending_validation" },
      }),
    ).toBe("verifying");
  });

  test("terminal states map to failed", () => {
    expect(mapCustomHostnameStatus({ id: "x", hostname: "h", status: "deleted" })).toBe("failed");
    expect(mapCustomHostnameStatus({ id: "x", hostname: "h", status: "blocked" })).toBe("failed");
    expect(
      mapCustomHostnameStatus({
        id: "x",
        hostname: "h",
        status: "active",
        ssl: { status: "validation_timed_out" },
      }),
    ).toBe("failed");
  });

  test("unknown states keep verifying", () => {
    expect(
      mapCustomHostnameStatus({
        id: "x",
        hostname: "h",
        status: "pending_deployment",
        ssl: { status: "initializing" },
      }),
    ).toBe("verifying");
  });
});

describe("buildDnsRecords", () => {
  test("always includes the routing CNAME and any CF validation records", () => {
    const records = buildDnsRecords("events.acme.com", {
      id: "x",
      hostname: "events.acme.com",
      ownership_verification: { name: "_cf.events.acme.com", type: "txt", value: "tok" },
      ssl: { validation_records: [{ txt_name: "_acme.events.acme.com", txt_value: "v" }] },
    });
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ type: "CNAME", name: "events.acme.com" });
    expect(records[1]).toMatchObject({ type: "TXT", value: "tok" });
    expect(records[2]).toMatchObject({ type: "TXT", value: "v" });
  });
});

describe("custom domain CRUD (dev mode, no Cloudflare env)", () => {
  test("create activates immediately and resolves by hostname", async () => {
    const org = await signUpAndCreateOrg();
    const hostname = host();

    const created = await createCustomDomain(org.orgId, hostname);
    expect(created.status).toBe("active");
    expect(created.hostname).toBe(hostname);
    expect(created.dnsRecords[0]?.type).toBe("CNAME");

    const fetched = await getCustomDomain(org.orgId);
    expect(fetched?.hostname).toBe(hostname);

    const resolved = await resolveOrgByHostname(hostname);
    expect(resolved?.orgId).toBe(org.orgId);

    expect(await publicOriginForOrg(org.orgId)).toContain(hostname);
    expect(await customDomainOriginForOrg(org.orgId)).toContain(hostname);

    invalidateDomainCache();
    await ensureFreshDomainCache();
    expect(lookupCustomDomainHost(hostname)?.orgId).toBe(org.orgId);

    await removeCustomDomain(org.orgId);
    expect(await getCustomDomain(org.orgId)).toBeNull();
    expect(await resolveOrgByHostname(hostname)).toBeNull();
    expect(await publicOriginForOrg(org.orgId)).toBe(PUBLIC_SITE_URL);
    expect(await customDomainOriginForOrg(org.orgId)).toBeNull();
  });

  test("rejects platform hostnames and invalid input", async () => {
    const org = await signUpAndCreateOrg();
    const webHost = new URL(PUBLIC_SITE_URL).hostname;
    expect(createCustomDomain(org.orgId, `evil.${webHost}`)).rejects.toThrow("invalid_hostname");
    expect(createCustomDomain(org.orgId, "not a host")).rejects.toThrow("invalid_hostname");
  });

  test("a hostname can only belong to one org", async () => {
    const orgA = await signUpAndCreateOrg();
    const orgB = await signUpAndCreateOrg();
    const hostname = host();
    await createCustomDomain(orgA.orgId, hostname);
    expect(createCustomDomain(orgB.orgId, hostname)).rejects.toThrow("hostname_taken");
    await removeCustomDomain(orgA.orgId);
  });

  test("replacing the org's domain frees the old hostname", async () => {
    const org = await signUpAndCreateOrg();
    const first = host();
    const second = host();
    await createCustomDomain(org.orgId, first);
    await createCustomDomain(org.orgId, second);
    expect(await resolveOrgByHostname(first)).toBeNull();
    expect((await resolveOrgByHostname(second))?.orgId).toBe(org.orgId);
    await removeCustomDomain(org.orgId);
  });
});
