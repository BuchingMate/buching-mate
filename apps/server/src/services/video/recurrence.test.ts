import { describe, expect, test } from "bun:test";
import { recurrenceForEvent } from "./index";

function eventStub(overrides: Partial<Parameters<typeof recurrenceForEvent>[0]> = {}) {
  return {
    id: "evt-1",
    orgId: "org-1",
    createdById: null,
    title: "T",
    description: null,
    notes: null,
    category: null,
    tags: [],
    date: "2026-06-15",
    time: "10:00:00",
    duration: 60,
    allDay: false,
    maxCapacity: null,
    location: null,
    status: "upcoming" as const,
    visibility: "published" as const,
    archivedAt: null,
    recurring: true,
    recurrenceFrequency: "weekly",
    recurrenceDays: ["Mon", "Wed"],
    recurrenceInterval: 1,
    recurrenceEndDate: "2026-08-15",
    price: 0,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Parameters<typeof recurrenceForEvent>[0];
}

describe("recurrenceForEvent", () => {
  test("returns null when not recurring", () => {
    expect(recurrenceForEvent(eventStub({ recurring: false }))).toBeNull();
  });

  test("returns null when frequency missing", () => {
    expect(recurrenceForEvent(eventStub({ recurrenceFrequency: null }))).toBeNull();
  });

  test("weekly maps day names to Zoom day numbers", () => {
    const rec = recurrenceForEvent(eventStub({ recurrenceDays: ["Mon", "Wed", "Fri"] }));
    expect(rec).not.toBeNull();
    expect(rec!.frequency).toBe("weekly");
    expect(rec!.weeklyDays).toEqual([2, 4, 6]);
  });

  test("daily uses interval", () => {
    const rec = recurrenceForEvent(
      eventStub({
        recurrenceFrequency: "daily",
        recurrenceInterval: 3,
        recurrenceDays: [],
      }),
    );
    expect(rec).not.toBeNull();
    expect(rec!.frequency).toBe("daily");
    expect(rec!.interval).toBe(3);
  });

  test("monthly derives monthly_day from event date", () => {
    const rec = recurrenceForEvent(
      eventStub({
        recurrenceFrequency: "monthly",
        date: "2026-06-15",
        recurrenceDays: [],
      }),
    );
    expect(rec).not.toBeNull();
    expect(rec!.monthlyDay).toBe(15);
  });

  test("endDateUtc set from recurrenceEndDate", () => {
    const rec = recurrenceForEvent(eventStub());
    expect(rec?.endDateUtc?.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  test("unrecognized day names ignored", () => {
    const rec = recurrenceForEvent(eventStub({ recurrenceDays: ["foo", "Tue"] }));
    expect(rec!.weeklyDays).toEqual([3]);
  });
});
