import { describe, expect, it } from "bun:test";
import { OrgNameError, sanitizeOrgName } from "./org-name";

describe("sanitizeOrgName", () => {
  it("accepts normal names", () => {
    expect(sanitizeOrgName("Acme Co")).toBe("Acme Co");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeOrgName("  Acme  ")).toBe("Acme");
  });

  it("strips zero-width and RTL-override characters", () => {
    expect(sanitizeOrgName("Acme​‮Co")).toBe("AcmeCo");
  });

  it("rejects empty after normalization", () => {
    expect(() => sanitizeOrgName("   ")).toThrow(OrgNameError);
  });

  it("rejects over-length", () => {
    expect(() => sanitizeOrgName("a".repeat(65))).toThrow(OrgNameError);
  });

  it("rejects names with explicit URL", () => {
    expect(() => sanitizeOrgName("Click https://phish.example")).toThrow(OrgNameError);
  });

  it("rejects bare-domain phishing payloads", () => {
    expect(() => sanitizeOrgName("Receipt at craftum.io now")).toThrow(OrgNameError);
  });
});
