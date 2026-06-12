import { describe, expect, test } from "bun:test";
import { renderRefundEmail } from "./email";

const input = {
  attendeeName: "Ada",
  eventTitle: "Yoga Night",
  orgName: "Acme Inc",
  amount: { amount: 2550, currency: "USD" },
  registrationId: "reg-123",
};

describe("renderRefundEmail", () => {
  test("names the amount and event in html and text", () => {
    const { html, text } = renderRefundEmail(input);
    expect(html).toContain("Refund processed");
    expect(html).toContain("$25.50");
    expect(html).toContain("Yoga Night");
    expect(text).toContain("your payment of $25.50 for Yoga Night has been refunded");
  });

  test("omits the amount when unknown", () => {
    const { html, text } = renderRefundEmail({ ...input, amount: null });
    expect(html).toContain("Your payment for <strong>Yoga Night</strong> has been refunded");
    expect(text).toContain("your payment for Yoga Night has been refunded");
  });

  test("keeps the booking reference in the footer", () => {
    const { html } = renderRefundEmail(input);
    expect(html).toContain("Booking reference: reg-123");
  });
});
