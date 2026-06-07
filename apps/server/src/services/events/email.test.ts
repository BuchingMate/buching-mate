import { describe, expect, test } from "bun:test";
import { renderEventCancelledEmail } from "./email";

describe("renderEventCancelledEmail", () => {
  test("should promise a refund to a paid attendee", () => {
    const { subject, html } = renderEventCancelledEmail({
      attendeeName: "Ada",
      eventTitle: "Yoga Night",
      orgName: "Acme Inc",
      refundExpected: true,
    });
    expect(subject).toBe("Event cancelled: Yoga Night");
    expect(html).toContain("Acme Inc");
    expect(html).toContain("Your payment will be refunded");
  });

  test("should not mention a refund for an unpaid registration", () => {
    const { html } = renderEventCancelledEmail({
      attendeeName: "Ada",
      eventTitle: "Yoga Night",
      orgName: "Acme Inc",
      refundExpected: false,
    });
    expect(html).not.toContain("refunded");
  });

  test("should escape html in user-controlled fields", () => {
    const { html } = renderEventCancelledEmail({
      attendeeName: "<script>",
      eventTitle: "A & B",
      orgName: "Acme",
      refundExpected: false,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("A &amp; B");
  });
});
