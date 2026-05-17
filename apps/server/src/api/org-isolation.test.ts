import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../test/helpers/auth";
import { seedEvent, seedResource } from "../../test/helpers/data";
import { asJson, req } from "../../test/helpers/request";

async function twoOrgs() {
  const [a, b] = await Promise.all([signUpAndCreateOrg(), signUpAndCreateOrg()]);
  return { a, b };
}

describe("org isolation: resources", () => {
  test("should not show another org's resources in the list", async () => {
    const { a, b } = await twoOrgs();
    await seedResource(a.orgId, { name: "Only In A" });

    const res = await req("/api/resources", { cookie: b.cookie, orgId: b.orgId });
    const body = await asJson<{ resources: Array<{ name: string }> }>(res);
    expect(body.resources.find((r) => r.name === "Only In A")).toBeUndefined();
  });

  test("should return 404 when reading a resource from another org", async () => {
    const { a, b } = await twoOrgs();
    const r = await seedResource(a.orgId);
    const res = await req(`/api/resources/${r.id}`, { cookie: b.cookie, orgId: b.orgId });
    expect(res.status).toBe(404);
  });

  test("should return 404 when updating a resource from another org", async () => {
    const { a, b } = await twoOrgs();
    const r = await seedResource(a.orgId);
    const res = await req(`/api/resources/${r.id}`, {
      method: "PATCH",
      body: { name: "Hacked" },
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });

  test("should return 404 when deleting a resource from another org", async () => {
    const { a, b } = await twoOrgs();
    const r = await seedResource(a.orgId);
    const res = await req(`/api/resources/${r.id}`, {
      method: "DELETE",
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });

  test("should return 404 when archiving a resource from another org", async () => {
    const { a, b } = await twoOrgs();
    const r = await seedResource(a.orgId);
    const res = await req(`/api/resources/${r.id}/archive`, {
      method: "POST",
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });
});

describe("org isolation: events", () => {
  test("should not show another org's events in the list", async () => {
    const { a, b } = await twoOrgs();
    await seedEvent(a.orgId, { title: "Only In A" });

    const res = await req("/api/events", { cookie: b.cookie, orgId: b.orgId });
    const body = await asJson<{ events: Array<{ title: string }> }>(res);
    expect(body.events.find((e) => e.title === "Only In A")).toBeUndefined();
  });

  test("should return 404 when reading an event from another org", async () => {
    const { a, b } = await twoOrgs();
    const e = await seedEvent(a.orgId);
    const res = await req(`/api/events/${e.id}`, { cookie: b.cookie, orgId: b.orgId });
    expect(res.status).toBe(404);
  });

  test("should return 404 when updating an event from another org", async () => {
    const { a, b } = await twoOrgs();
    const e = await seedEvent(a.orgId);
    const res = await req(`/api/events/${e.id}`, {
      method: "PATCH",
      body: { title: "Hacked" },
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });

  test("should return 404 when deleting an event from another org", async () => {
    const { a, b } = await twoOrgs();
    const e = await seedEvent(a.orgId);
    const res = await req(`/api/events/${e.id}`, {
      method: "DELETE",
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });

  test("should return 404 when duplicating an event from another org", async () => {
    const { a, b } = await twoOrgs();
    const e = await seedEvent(a.orgId);
    const res = await req(`/api/events/${e.id}/duplicate`, {
      method: "POST",
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });
});
