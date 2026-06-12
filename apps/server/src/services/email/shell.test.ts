import { describe, expect, test } from "bun:test";
import { PLATFORM_BRAND, renderEmailShell, renderEmailText } from "./shell";

describe("renderEmailShell", () => {
  test("tenant brand shows org masthead, accent bar, and via signature", () => {
    const html = renderEmailShell({
      brand: { name: "Acme & Co", logoUrl: null, accentColor: "#ff0000" },
      preheader: "Hello preview",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain("Acme &amp; Co");
    expect(html).toContain("background:#ff0000");
    expect(html).toContain("Hello preview");
    expect(html).toContain("Sent by Acme &amp; Co via BuchingMate");
  });

  test("logo replaces the text masthead when set", () => {
    const html = renderEmailShell({
      brand: { name: "Acme", logoUrl: "https://cdn.example/logo.png", accentColor: null },
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain('src="https://cdn.example/logo.png"');
  });

  test("invalid accent falls back to the default", () => {
    const html = renderEmailShell({
      brand: { name: "Acme", logoUrl: null, accentColor: "red;}<script>" },
      bodyHtml: "<p>Body</p>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("background:#1f2430");
  });

  test("platform brand signs with the platform name only", () => {
    const html = renderEmailShell({ brand: PLATFORM_BRAND, bodyHtml: "<p>Body</p>" });
    expect(html).not.toContain("Sent by");
    expect(html).toContain("BuchingMate");
  });
});

describe("renderEmailText", () => {
  test("drops falsy lines and appends the signature", () => {
    const text = renderEmailText(["Hi", false, null, "Bye"], {
      name: "Acme",
      logoUrl: null,
      accentColor: null,
    });
    expect(text).toBe("Hi\nBye\n\nSent by Acme via BuchingMate");
  });
});
