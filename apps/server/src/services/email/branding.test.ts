import { describe, expect, test } from "bun:test";
import { brandingAccent, renderBroadcastEmail, EMPTY_EMAIL_BRANDING } from "@workspace/contracts";

describe("brandingAccent", () => {
  test("should accept a valid 6-digit hex color", () => {
    expect(brandingAccent("#e2552b")).toBe("#e2552b");
  });

  test("should reject a non-hex value and fall back to the default ink", () => {
    expect(brandingAccent("red")).toBe("#1f2430");
    expect(brandingAccent("javascript:alert(1)")).toBe("#1f2430");
  });

  test("should fall back when the color is missing", () => {
    expect(brandingAccent(null)).toBe("#1f2430");
    expect(brandingAccent(undefined)).toBe("#1f2430");
  });
});

describe("renderBroadcastEmail", () => {
  test("should include the subject and the org's own body html", () => {
    const html = renderBroadcastEmail({
      subject: "Spring classes",
      bodyHtml: "<p>Doors open at 9.</p>",
      orgName: "Acme",
      branding: EMPTY_EMAIL_BRANDING,
    });
    expect(html).toContain("Spring classes");
    expect(html).toContain("<p>Doors open at 9.</p>");
  });

  test("should use the org name in the footer when no footer text is set", () => {
    const html = renderBroadcastEmail({
      subject: "Hi",
      bodyHtml: "x",
      orgName: "Acme",
      branding: EMPTY_EMAIL_BRANDING,
    });
    expect(html).toContain("Sent by Acme");
  });

  test("should apply a valid accent color and ignore an invalid one", () => {
    const good = renderBroadcastEmail({
      subject: "Hi",
      bodyHtml: "x",
      orgName: "Acme",
      branding: { ...EMPTY_EMAIL_BRANDING, accentColor: "#00ff88" },
    });
    expect(good).toContain("#00ff88");

    const bad = renderBroadcastEmail({
      subject: "Hi",
      bodyHtml: "x",
      orgName: "Acme",
      branding: { ...EMPTY_EMAIL_BRANDING, accentColor: "not-a-color" },
    });
    expect(bad).toContain("#1f2430");
    expect(bad).not.toContain("not-a-color");
  });

  test("should escape the org name in the subject heading area", () => {
    const html = renderBroadcastEmail({
      subject: "Hi",
      bodyHtml: "x",
      orgName: "<script>",
      branding: EMPTY_EMAIL_BRANDING,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("should render the unsubscribe link and postal address in the footer", () => {
    const html = renderBroadcastEmail({
      subject: "Hi",
      bodyHtml: "x",
      orgName: "Acme",
      branding: EMPTY_EMAIL_BRANDING,
      unsubscribeUrl: "https://api.example/api/public/unsubscribe?token=abc",
      businessAddress: "1 Main St, Sydney NSW 2000",
    });
    expect(html).toContain('href="https://api.example/api/public/unsubscribe?token=abc"');
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("1 Main St, Sydney NSW 2000");
  });

  test("should omit the unsubscribe line when no url is given (live preview)", () => {
    const html = renderBroadcastEmail({
      subject: "Hi",
      bodyHtml: "x",
      orgName: "Acme",
      branding: EMPTY_EMAIL_BRANDING,
    });
    expect(html).not.toContain("Unsubscribe");
  });

  test("should escape a postal address that contains markup", () => {
    const html = renderBroadcastEmail({
      subject: "Hi",
      bodyHtml: "x",
      orgName: "Acme",
      branding: EMPTY_EMAIL_BRANDING,
      unsubscribeUrl: "https://api.example/u?token=abc",
      businessAddress: "<b>HQ</b>",
    });
    expect(html).not.toContain("<b>HQ</b>");
    expect(html).toContain("&lt;b&gt;HQ&lt;/b&gt;");
  });
});
