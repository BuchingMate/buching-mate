import { describe, expect, test } from "bun:test";
import { buildSender, senderAddress } from "./mailer";

const PLATFORM = "noreply@buchingmate.com";

describe("senderAddress", () => {
  test("should use the org's verified domain when it has one", () => {
    const address = senderAddress({ verifiedDomain: "acme.com", platformAddress: PLATFORM });
    expect(address).toBe("noreply@acme.com");
  });

  test("should fall back to the platform address when there is no verified domain", () => {
    const address = senderAddress({ verifiedDomain: null, platformAddress: PLATFORM });
    expect(address).toBe(PLATFORM);
  });
});

describe("buildSender", () => {
  test("should show the org name over the platform address", () => {
    const sender = buildSender({
      orgName: "Acme Events",
      contactEmail: "hello@acme.com",
      address: PLATFORM,
    });
    expect(sender.from).toBe(`Acme Events <${PLATFORM}>`);
  });

  test("should use the org contact email as reply-to", () => {
    const sender = buildSender({
      orgName: "Acme Events",
      contactEmail: "hello@acme.com",
      address: PLATFORM,
    });
    expect(sender.replyTo).toBe("hello@acme.com");
  });

  test("should leave reply-to unset when the org has no contact email", () => {
    const sender = buildSender({
      orgName: "Acme Events",
      contactEmail: null,
      address: PLATFORM,
    });
    expect(sender.replyTo).toBeUndefined();
  });

  test("should fall back to the bare platform address when the org has no name", () => {
    const sender = buildSender({
      orgName: null,
      contactEmail: null,
      address: PLATFORM,
    });
    expect(sender.from).toBe(PLATFORM);
  });

  test("should quote a name that holds special characters", () => {
    const sender = buildSender({
      orgName: "Acme, Inc.",
      contactEmail: null,
      address: PLATFORM,
    });
    expect(sender.from).toBe(`"Acme, Inc." <${PLATFORM}>`);
  });

  test("should strip quotes and line breaks from the name", () => {
    const sender = buildSender({
      orgName: 'Ac"me\r\nEvil',
      contactEmail: null,
      address: PLATFORM,
    });
    expect(sender.from).toBe(`AcmeEvil <${PLATFORM}>`);
  });
});
