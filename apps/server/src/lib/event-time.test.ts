import { describe, expect, test } from "bun:test";
import {
  durationMinutes,
  eventEndUtc,
  eventStartUtc,
  formatEventDateTime,
  utcToZonedWallClock,
  zonedWallClockToUtc,
} from "./event-time";

describe("event-time", () => {
  test("UTC zone matches the old naive parsing", () => {
    expect(eventStartUtc("2026-05-24", "18:00", "UTC").toISOString()).toBe(
      "2026-05-24T18:00:00.000Z",
    );
    // HH:MM:SS form is truncated to HH:MM like the previous behavior.
    expect(eventStartUtc("2026-05-24", "18:00:00", "UTC").toISOString()).toBe(
      "2026-05-24T18:00:00.000Z",
    );
  });

  test("Europe/Berlin summer is UTC+2 (DST)", () => {
    expect(eventStartUtc("2026-05-24", "18:00", "Europe/Berlin").toISOString()).toBe(
      "2026-05-24T16:00:00.000Z",
    );
  });

  test("Europe/Berlin winter is UTC+1 (no DST)", () => {
    expect(eventStartUtc("2026-01-15", "18:00", "Europe/Berlin").toISOString()).toBe(
      "2026-01-15T17:00:00.000Z",
    );
  });

  test("eventEndUtc returns null without an explicit end", () => {
    expect(eventEndUtc(null, null, "UTC")).toBeNull();
    expect(eventEndUtc("2026-05-24", null, "UTC")).toBeNull();
  });

  test("round-trip: utcToZonedWallClock inverts zonedWallClockToUtc", () => {
    const utc = zonedWallClockToUtc("2026-05-24", "18:30", "America/New_York");
    expect(utcToZonedWallClock(utc, "America/New_York")).toEqual({
      date: "2026-05-24",
      time: "18:30",
    });
  });

  test("midnight in UTC", () => {
    expect(eventStartUtc("2026-05-24", "00:00", "UTC").toISOString()).toBe(
      "2026-05-24T00:00:00.000Z",
    );
    expect(utcToZonedWallClock(new Date("2026-05-24T00:00:00.000Z"), "UTC")).toEqual({
      date: "2026-05-24",
      time: "00:00",
    });
  });

  test("midnight round-trip in America/New_York (across DST start)", () => {
    // 2026-03-08 02:00 EST -> EDT skip. Midnight before/after the transition
    // should round-trip without a day drift.
    const before = zonedWallClockToUtc("2026-03-07", "00:00", "America/New_York");
    expect(utcToZonedWallClock(before, "America/New_York")).toEqual({
      date: "2026-03-07",
      time: "00:00",
    });
    const after = zonedWallClockToUtc("2026-03-09", "00:00", "America/New_York");
    expect(utcToZonedWallClock(after, "America/New_York")).toEqual({
      date: "2026-03-09",
      time: "00:00",
    });
  });

  test("durationMinutes computes minute delta with a 1-minute floor", () => {
    const start = eventStartUtc("2026-05-24", "18:00", "UTC");
    const end = eventStartUtc("2026-05-24", "19:30", "UTC");
    expect(durationMinutes(start, end)).toBe(90);
    expect(durationMinutes(end, end)).toBe(1);
  });
});

describe("formatEventDateTime", () => {
  test("same-day event renders a time range with timezone name", () => {
    const start = eventStartUtc("2026-06-06", "15:00", "Australia/Sydney");
    const end = eventStartUtc("2026-06-06", "16:00", "Australia/Sydney");
    const { dateLabel, timeLabel } = formatEventDateTime(start, end, "Australia/Sydney");
    expect(dateLabel).toBe("Saturday, June 6, 2026");
    expect(timeLabel).toMatch(/^3:00 PM – 4:00 PM GMT\+10$/);
  });

  test("UTC event keeps UTC label", () => {
    const start = eventStartUtc("2026-06-06", "09:30", "UTC");
    const end = eventStartUtc("2026-06-06", "10:00", "UTC");
    const { dateLabel, timeLabel } = formatEventDateTime(start, end, "UTC");
    expect(dateLabel).toBe("Saturday, June 6, 2026");
    expect(timeLabel).toContain("9:30");
    expect(timeLabel).toContain("UTC");
  });

  test("event crossing midnight shows start time only", () => {
    const start = eventStartUtc("2026-06-06", "23:00", "America/New_York");
    const end = eventStartUtc("2026-06-07", "01:00", "America/New_York");
    const { timeLabel } = formatEventDateTime(start, end, "America/New_York");
    expect(timeLabel).toMatch(/^11:00 PM EDT$/);
  });

  test("null end falls back to start time only", () => {
    const start = eventStartUtc("2026-06-06", "15:00", "UTC");
    const { timeLabel } = formatEventDateTime(start, null, "UTC");
    expect(timeLabel).toContain("3:00");
    expect(timeLabel).not.toContain("–");
  });
});
