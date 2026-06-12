import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../test/helpers/auth";
import { setOrgPlan } from "../../test/helpers/data";
import { asJson, req } from "../../test/helpers/request";

const validEvent = {
  title: "Yoga Class",
  date: "2026-06-01",
  time: "10:00:00",
  duration: 60,
  videoProvider: null,
};

describe("free plan limits", () => {
  test("should block duplicating an event when the free plan limit is already used", async () => {
    const fx = await signUpAndCreateOrg();
    const created = await req("/api/events", {
      method: "POST",
      body: validEvent,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(created.status).toBe(201);
    const body = await asJson<{ event: { id: string } }>(created);

    const dup = await req(`/api/events/${body.event.id}/duplicate`, {
      method: "POST",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(dup.status).toBe(402);
  });
});

describe("team plan removes free plan limits", () => {
  test("should allow more than one event per month on the team plan", async () => {
    const fx = await signUpAndCreateOrg();
    await setOrgPlan(fx.orgId, "team");

    const first = await req("/api/events", {
      method: "POST",
      body: validEvent,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(first.status).toBe(201);

    const second = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, title: "Second" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(second.status).toBe(201);
  });

  test("should allow duplicating events on the team plan", async () => {
    const fx = await signUpAndCreateOrg();
    await setOrgPlan(fx.orgId, "team");

    const created = await req("/api/events", {
      method: "POST",
      body: validEvent,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    const body = await asJson<{ event: { id: string } }>(created);

    const dup = await req(`/api/events/${body.event.id}/duplicate`, {
      method: "POST",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(dup.status).toBe(201);
  });
});

describe("custom domain plan gating", () => {
  test("should block adding a custom domain on the free plan", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/org/custom-domain", {
      method: "POST",
      body: { domain: `gate-${Date.now()}.example.com` },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(402);
  });

  test("should allow adding a custom domain on the team plan", async () => {
    const fx = await signUpAndCreateOrg();
    await setOrgPlan(fx.orgId, "team");
    const res = await req("/api/org/custom-domain", {
      method: "POST",
      body: { domain: `gate-${Date.now()}-team.example.com` },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const cleanup = await req("/api/org/custom-domain", {
      method: "DELETE",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(cleanup.status).toBe(200);
  });
});

describe("enterprise plan removes free plan limits", () => {
  test("should allow more than one event per month on the enterprise plan", async () => {
    const fx = await signUpAndCreateOrg();
    await setOrgPlan(fx.orgId, "enterprise");

    const first = await req("/api/events", {
      method: "POST",
      body: validEvent,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(first.status).toBe(201);

    const second = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, title: "Second" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(second.status).toBe(201);
  });
});
