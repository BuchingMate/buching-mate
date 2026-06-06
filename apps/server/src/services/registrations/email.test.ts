import { describe, expect, test } from "bun:test";
import { renderConfirmationEmail } from "./email";

const input = {
  attendeeName: "Alex <Test>",
  eventTitle: "Morning Yoga",
  orgName: "Acme Inc",
  timezone: "Australia/Sydney",
  location: "1 Main St, Sydney",
  registrationId: "ddb59c82-c7c9-4f09-b0a0-141ec87917f4",
  joinUrl: null,
  startUtc: new Date("2026-06-06T05:00:00.000Z"), // 3:00 PM AEST
  endUtc: new Date("2026-06-06T06:00:00.000Z"),
  description: null,
  manageUrl: "http://acme.lvh.me:5678/me",
};

describe("renderConfirmationEmail", () => {
  test("renders attendee-friendly date and time in the event timezone", () => {
    const { html, text } = renderConfirmationEmail(input);
    expect(html).toContain("Saturday, June 6, 2026");
    expect(html).toContain("3:00 PM – 4:00 PM GMT+10");
    expect(text).toContain("Date: Saturday, June 6, 2026");
  });

  test("includes calendar links, map link, and manage link", () => {
    const { html, text } = renderConfirmationEmail(input);
    expect(html).toContain("https://calendar.google.com/calendar/render");
    expect(html).toContain("https://outlook.live.com/calendar/0/action/compose");
    expect(html).toContain("https://www.google.com/maps/search/");
    expect(html).toContain(input.manageUrl);
    expect(text).toContain("Manage your booking: http://acme.lvh.me:5678/me");
  });

  test("escapes user-provided values and keeps reference in the footer", () => {
    const { html } = renderConfirmationEmail(input);
    expect(html).toContain("Alex &lt;Test&gt;");
    expect(html).toContain("Booking reference: ddb59c82-c7c9-4f09-b0a0-141ec87917f4");
  });

  test("shows join button and Online location for video-only events", () => {
    const { html, text } = renderConfirmationEmail({
      ...input,
      joinUrl: "https://zoom.us/j/123",
      location: null,
    });
    expect(html).toContain("Join meeting");
    expect(html).toContain("https://zoom.us/j/123");
    expect(html).toContain(">Online</td>");
    expect(text).toContain("Location: Online");
  });

  test("falls back to a location placeholder and always names the host", () => {
    const { html, text } = renderConfirmationEmail({ ...input, location: null, joinUrl: null });
    expect(html).toContain("To be announced");
    expect(html).toContain(">Acme Inc</td>");
    expect(text).toContain("Location: To be announced");
    expect(text).toContain("Host: Acme Inc");
  });

  test("renders the event description when present", () => {
    const { html, text } = renderConfirmationEmail({
      ...input,
      description: "Bring a mat.\nDoors open 15 min early.",
    });
    expect(html).toContain("About this event");
    expect(html).toContain("Bring a mat.<br/>Doors open 15 min early.");
    expect(text).toContain("About this event: Bring a mat.");
  });

  test("preheader summarises date, time, and place", () => {
    const { html } = renderConfirmationEmail(input);
    expect(html).toContain("Saturday, June 6, 2026 · 3:00 PM – 4:00 PM GMT+10 · 1 Main St, Sydney");
  });
});
