import { describe, expect, test } from "bun:test";
import { buildEventIcs } from "./ics";

describe("buildEventIcs", () => {
  test("includes core VEVENT fields", () => {
    const ics = buildEventIcs({
      uid: "event-1@buchingmate",
      title: "Yoga Class",
      description: "Bring a mat",
      startUtc: new Date("2026-06-01T10:00:00Z"),
      endUtc: new Date("2026-06-01T11:00:00Z"),
      location: "Studio A",
      joinUrl: "https://zoom.us/j/123",
      organizerEmail: "host@example.com",
      organizerName: "Host Org",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:event-1@buchingmate");
    expect(ics).toContain("DTSTART:20260601T100000Z");
    expect(ics).toContain("DTEND:20260601T110000Z");
    expect(ics).toContain("SUMMARY:Yoga Class");
    expect(ics).toContain("LOCATION:Studio A");
    expect(ics).toContain("URL:https://zoom.us/j/123");
    expect(ics).toContain("ORGANIZER;CN=Host Org:mailto:host@example.com");
    expect(ics).toContain("Bring a mat");
    expect(ics).toContain("Join: https://zoom.us/j/123");
  });

  test("escapes commas, semicolons, newlines in description", () => {
    const ics = buildEventIcs({
      uid: "u",
      title: "T",
      description: "a; b, c\nnext",
      startUtc: new Date("2026-06-01T10:00:00Z"),
      endUtc: new Date("2026-06-01T11:00:00Z"),
      location: null,
      joinUrl: null,
      organizerEmail: null,
      organizerName: null,
    });
    expect(ics).toContain("a\\; b\\, c\\nnext");
  });

  test("omits optional fields cleanly", () => {
    const ics = buildEventIcs({
      uid: "u",
      title: "T",
      description: null,
      startUtc: new Date("2026-06-01T10:00:00Z"),
      endUtc: new Date("2026-06-01T11:00:00Z"),
      location: null,
      joinUrl: null,
      organizerEmail: null,
      organizerName: null,
    });
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("URL:");
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("DESCRIPTION:");
  });
});
