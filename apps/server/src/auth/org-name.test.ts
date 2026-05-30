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

  it("rejects names with www. prefix", () => {
    expect(() => sanitizeOrgName("Visit www.phish.example")).toThrow(OrgNameError);
  });

  it("accepts brand names containing a dot", () => {
    expect(sanitizeOrgName("Acme.io")).toBe("Acme.io");
    expect(sanitizeOrgName("Vue.js Berlin")).toBe("Vue.js Berlin");
  });
});
