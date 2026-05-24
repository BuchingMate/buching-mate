import { describe, expect, test } from "bun:test";
import { monthStart, weekStart } from "./subscription-usage";

describe("weekStart", () => {
  test("should return the same Monday for a midweek day", () => {
    // 2026-05-20 is a Wednesday.
    const start = weekStart(new Date("2026-05-20T15:30:00Z"));
    expect(start.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });

  test("should treat Monday as the start of its own week", () => {
    const start = weekStart(new Date("2026-05-18T00:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });

  test("should map Sunday back to the previous Monday", () => {
    // 2026-05-24 is a Sunday.
    const start = weekStart(new Date("2026-05-24T23:59:00Z"));
    expect(start.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });
});

describe("monthStart", () => {
  test("should return the first day of the month at midnight UTC", () => {
    const start = monthStart(new Date("2026-05-24T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });
});
