import { describe, expect, test } from "bun:test";
import { googleCalendarUrl, outlookCalendarUrl } from "./calendar-links";

const base = {
  title: "Yoga & Brunch",
  description: "Bring a mat",
  startUtc: new Date("2026-06-06T05:00:00.000Z"),
  endUtc: new Date("2026-06-06T06:00:00.000Z"),
  location: "1 Main St, Sydney",
  joinUrl: null,
};

describe("calendar links", () => {
  test("google link carries UTC range, title, details, location", () => {
    const url = new URL(googleCalendarUrl(base));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Yoga & Brunch");
    expect(url.searchParams.get("dates")).toBe("20260606T050000Z/20260606T060000Z");
    expect(url.searchParams.get("details")).toBe("Bring a mat");
    expect(url.searchParams.get("location")).toBe("1 Main St, Sydney");
  });

  test("outlook link uses ISO instants", () => {
    const url = new URL(outlookCalendarUrl(base));
    expect(url.origin + url.pathname).toBe("https://outlook.live.com/calendar/0/action/compose");
    expect(url.searchParams.get("subject")).toBe("Yoga & Brunch");
    expect(url.searchParams.get("startdt")).toBe("2026-06-06T05:00:00.000Z");
    expect(url.searchParams.get("enddt")).toBe("2026-06-06T06:00:00.000Z");
  });

  test("join url is appended to details and empty fields are omitted", () => {
    const url = new URL(
      googleCalendarUrl({
        ...base,
        description: null,
        location: null,
        joinUrl: "https://zoom.us/j/1",
      }),
    );
    expect(url.searchParams.get("details")).toBe("Join: https://zoom.us/j/1");
    expect(url.searchParams.has("location")).toBe(false);
  });
});
