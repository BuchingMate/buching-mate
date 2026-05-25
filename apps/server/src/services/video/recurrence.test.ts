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

describe("recurrenceForEvent — gating", () => {
  test("returns null when not recurring", () => {
    expect(recurrenceForEvent(eventStub({ recurring: false }))).toBeNull();
  });

  test("returns null when frequency missing", () => {
    expect(recurrenceForEvent(eventStub({ recurrenceFrequency: null }))).toBeNull();
  });

  test.each(["yearly", "custom", "fortnightly", ""])(
    "returns null for unsupported frequency %p",
    (freq) => {
      expect(recurrenceForEvent(eventStub({ recurrenceFrequency: freq }))).toBeNull();
    },
  );

  test("frequency is case-insensitive", () => {
    expect(recurrenceForEvent(eventStub({ recurrenceFrequency: "WEEKLY" }))?.frequency).toBe(
      "weekly",
    );
  });
});

describe("recurrenceForEvent — daily", () => {
  const daily = (o = {}) =>
    recurrenceForEvent(eventStub({ recurrenceFrequency: "daily", recurrenceDays: [], ...o }));

  test("explicit interval is kept", () => {
    const rec = daily({ recurrenceInterval: 3 });
    expect(rec).toMatchObject({ frequency: "daily", interval: 3 });
  });

  test.each([null, 0, -2])("interval %p falls back to 1", (interval) => {
    expect(daily({ recurrenceInterval: interval })?.interval).toBe(1);
  });

  test("ignores weekday selection", () => {
    expect(daily({ recurrenceDays: ["Mon", "Tue"] })?.weeklyDays).toBeUndefined();
  });

  test("does not derive a monthly day", () => {
    expect(daily()?.monthlyDay).toBeUndefined();
  });
});

describe("recurrenceForEvent — weekly", () => {
  test("maps day names to Zoom day numbers (Sun=1..Sat=7)", () => {
    const rec = recurrenceForEvent(eventStub({ recurrenceDays: ["Mon", "Wed", "Fri"] }));
    expect(rec!.weeklyDays).toEqual([2, 4, 6]);
  });

  test("dedupes and sorts days regardless of input order", () => {
    const rec = recurrenceForEvent(eventStub({ recurrenceDays: ["Fri", "Mon", "fri", "Sun"] }));
    expect(rec!.weeklyDays).toEqual([1, 2, 6]);
  });

  test("unrecognized day names are ignored", () => {
    expect(recurrenceForEvent(eventStub({ recurrenceDays: ["foo", "Tue"] }))!.weeklyDays).toEqual([
      3,
    ]);
  });

  test("empty days omits weeklyDays entirely", () => {
    expect(recurrenceForEvent(eventStub({ recurrenceDays: [] }))!.weeklyDays).toBeUndefined();
  });

  test("respects a custom weekly interval", () => {
    expect(recurrenceForEvent(eventStub({ recurrenceInterval: 3 }))!.interval).toBe(3);
  });
});

describe("recurrenceForEvent — biweekly", () => {
  test("maps to weekly with interval 2", () => {
    const rec = recurrenceForEvent(eventStub({ recurrenceFrequency: "biweekly" }));
    expect(rec).toMatchObject({ frequency: "weekly", interval: 2 });
  });

  test("forces interval 2 even when a different interval is stored", () => {
    const rec = recurrenceForEvent(
      eventStub({ recurrenceFrequency: "biweekly", recurrenceInterval: 5 }),
    );
    expect(rec!.interval).toBe(2);
  });

  test("preserves selected weekdays", () => {
    const rec = recurrenceForEvent(
      eventStub({ recurrenceFrequency: "biweekly", recurrenceDays: ["Tue", "Thu"] }),
    );
    expect(rec!.weeklyDays).toEqual([3, 5]);
  });
});

describe("recurrenceForEvent — monthly", () => {
  const monthly = (date: string) =>
    recurrenceForEvent(eventStub({ recurrenceFrequency: "monthly", recurrenceDays: [], date }));

  test.each([
    ["2026-06-15", 15],
    ["2026-06-01", 1],
    ["2026-01-31", 31],
  ])("derives monthly_day %p from event date", (date, day) => {
    expect(monthly(date)!.monthlyDay).toBe(day);
  });

  test("ignores weekday selection", () => {
    const rec = recurrenceForEvent(
      eventStub({ recurrenceFrequency: "monthly", recurrenceDays: ["Mon"] }),
    );
    expect(rec!.weeklyDays).toBeUndefined();
  });
});

describe("recurrenceForEvent — end condition", () => {
  test("sets endDateUtc to end-of-day UTC from recurrenceEndDate", () => {
    const rec = recurrenceForEvent(eventStub({ recurrenceEndDate: "2026-08-15" }));
    expect(rec!.endDateUtc?.toISOString()).toBe("2026-08-15T23:59:59.000Z");
  });

  test("no end date means no endDateUtc (repeats indefinitely)", () => {
    expect(recurrenceForEvent(eventStub({ recurrenceEndDate: null }))!.endDateUtc).toBeUndefined();
  });

  test("invalid end date is ignored", () => {
    expect(
      recurrenceForEvent(eventStub({ recurrenceEndDate: "not-a-date" }))!.endDateUtc,
    ).toBeUndefined();
  });
});
