import { describe, expect, test } from "bun:test";
import { createCalendarToken, verifyCalendarToken } from "./calendar-token";

describe("calendar token", () => {
  test("round-trips orgId and lowercased email", () => {
    const token = createCalendarToken({ orgId: "org_1", email: "Ada@Example.com" });
    const payload = verifyCalendarToken(token);
    expect(payload.orgId).toBe("org_1");
    expect(payload.email).toBe("ada@example.com");
  });

  test("rejects a tampered signature", () => {
    const token = createCalendarToken({ orgId: "org_1", email: "a@b.com" });
    const [encoded] = token.split(".");
    expect(() => verifyCalendarToken(`${encoded}.deadbeef`)).toThrow();
  });

  test("rejects a malformed token", () => {
    expect(() => verifyCalendarToken("nonsense")).toThrow();
  });
});
