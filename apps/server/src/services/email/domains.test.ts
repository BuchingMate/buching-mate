import { describe, expect, test } from "bun:test";
import { mapDnsRecords, mapDomainStatus } from "./domains";

describe("mapDomainStatus", () => {
  test("should map verified to active", () => {
    expect(mapDomainStatus("verified")).toBe("active");
  });

  test("should map not_started to pending", () => {
    expect(mapDomainStatus("not_started")).toBe("pending");
  });

  test("should map failure states to failed", () => {
    expect(mapDomainStatus("failed")).toBe("failed");
    expect(mapDomainStatus("failure")).toBe("failed");
  });

  test("should treat an unknown status as verifying", () => {
    expect(mapDomainStatus("pending")).toBe("verifying");
    expect(mapDomainStatus(undefined)).toBe("verifying");
  });
});

describe("mapDnsRecords", () => {
  test("should keep records that have a name, type, and value", () => {
    const records = mapDnsRecords([
      { record: "DKIM", name: "resend._domainkey", type: "TXT", value: "p=abc", ttl: "Auto" },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      record: "DKIM",
      name: "resend._domainkey",
      type: "TXT",
      value: "p=abc",
      ttl: "Auto",
      priority: undefined,
      status: undefined,
    });
  });

  test("should drop records missing a required part", () => {
    const records = mapDnsRecords([{ name: "only-name" }, { type: "TXT", value: "no-name" }]);
    expect(records).toHaveLength(0);
  });

  test("should return an empty list when given nothing", () => {
    expect(mapDnsRecords(null)).toEqual([]);
    expect(mapDnsRecords(undefined)).toEqual([]);
  });
});
