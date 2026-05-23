import { describe, expect, test } from "bun:test";
import { issueOAuthState, verifyOAuthState } from "./oauth-state";

describe("OAuth state token", () => {
  test("roundtrip returns same orgId/userId", () => {
    const token = issueOAuthState("org_123", "user_456");
    const verified = verifyOAuthState(token);
    expect(verified.orgId).toBe("org_123");
    expect(verified.userId).toBe("user_456");
    expect(verified.exp).toBeGreaterThan(Date.now());
    expect(verified.nonce).toMatch(/^[0-9a-f]+$/);
  });

  test("two tokens for same input differ (nonce)", () => {
    const a = issueOAuthState("org_x", "user_x");
    const b = issueOAuthState("org_x", "user_x");
    expect(a).not.toBe(b);
  });

  test("tampered token throws", () => {
    const token = issueOAuthState("org_t", "user_t");
    const tampered = token.slice(0, -4) + "AAAA";
    expect(() => verifyOAuthState(tampered)).toThrow();
  });

  test("non-base64 throws", () => {
    expect(() => verifyOAuthState("@@@not-valid@@@")).toThrow();
  });
});
