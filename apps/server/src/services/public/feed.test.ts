import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import { seedEvent } from "../../../test/helpers/data";
import { createCustomDomain, removeCustomDomain } from "../domains";
import { getGlobalPublicEvent, listAllPublicEvents } from "./index";

function host() {
  return `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.example.com`;
}

describe("listAllPublicEvents", () => {
  test("includes published upcoming events across orgs, excludes drafts", async () => {
    const orgA = await signUpAndCreateOrg();
    const orgB = await signUpAndCreateOrg();

    const published = await seedEvent(orgA.orgId, { visibility: "published" });
    const alsoPublished = await seedEvent(orgB.orgId, { visibility: "published" });
    const draft = await seedEvent(orgA.orgId, { visibility: "unpublished" });
    const completed = await seedEvent(orgB.orgId, {
      visibility: "published",
      status: "completed",
    });

    const feed = await listAllPublicEvents();
    const ids = feed.map((item) => item.event.id);
    expect(ids).toContain(published.id);
    expect(ids).toContain(alsoPublished.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(completed.id);

    const item = feed.find((i) => i.event.id === published.id);
    expect(item?.org.id).toBe(orgA.orgId);
    expect(item?.event.notes).toBeNull();
  });

  test("excludes orgs with an active custom domain", async () => {
    const org = await signUpAndCreateOrg();
    const event = await seedEvent(org.orgId, { visibility: "published" });

    let feed = await listAllPublicEvents();
    expect(feed.map((i) => i.event.id)).toContain(event.id);

    const hostname = host();
    await createCustomDomain(org.orgId, hostname); // dev mode → active immediately

    feed = await listAllPublicEvents();
    expect(feed.map((i) => i.event.id)).not.toContain(event.id);

    // The direct link still resolves, pointing at the org's own domain.
    const global = await getGlobalPublicEvent(event.id);
    expect(global?.customDomainOrigin).toContain(hostname);
    expect(global?.org.id).toBe(org.orgId);

    await removeCustomDomain(org.orgId);
    feed = await listAllPublicEvents();
    expect(feed.map((i) => i.event.id)).toContain(event.id);
  });
});

describe("getGlobalPublicEvent", () => {
  test("returns null for drafts and unknown ids", async () => {
    const org = await signUpAndCreateOrg();
    const draft = await seedEvent(org.orgId, { visibility: "unpublished" });
    expect(await getGlobalPublicEvent(draft.id)).toBeNull();
    expect(await getGlobalPublicEvent(crypto.randomUUID())).toBeNull();
  });

  test("returns event with org context and null customDomainOrigin without a domain", async () => {
    const org = await signUpAndCreateOrg();
    const event = await seedEvent(org.orgId, { visibility: "published" });
    const global = await getGlobalPublicEvent(event.id);
    expect(global?.event.id).toBe(event.id);
    expect(global?.org.id).toBe(org.orgId);
    expect(global?.customDomainOrigin).toBeNull();
  });
});
