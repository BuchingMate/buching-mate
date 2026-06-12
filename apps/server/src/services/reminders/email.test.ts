import { describe, expect, test } from "bun:test";
import { renderReminderEmail } from "./index";

const input = {
  attendeeName: "Ada",
  eventTitle: "Yoga Night",
  orgName: "Acme Inc",
  whenLabel: "is tomorrow",
  dateLabel: "Saturday, June 6, 2026",
  timeLabel: "3:00 PM – 4:00 PM GMT+10",
  location: "1 Main St, Sydney",
  joinUrl: null,
  manageUrl: "http://acme.lvh.me:5678/me",
};

describe("renderReminderEmail", () => {
  test("shows detail rows and manage link in html and text", () => {
    const { html, text } = renderReminderEmail(input);
    expect(html).toContain("Saturday, June 6, 2026");
    expect(html).toContain("https://www.google.com/maps/search/");
    expect(html).toContain(input.manageUrl);
    expect(text).toContain("Date: Saturday, June 6, 2026");
    expect(text).toContain("Manage your booking: http://acme.lvh.me:5678/me");
  });

  test("falls back to Online for video-only events", () => {
    const { html, text } = renderReminderEmail({
      ...input,
      location: null,
      joinUrl: "https://zoom.us/j/1",
    });
    expect(html).toContain(">Online</td>");
    expect(html).toContain("Join meeting");
    expect(text).toContain("Location: Online");
  });
});
