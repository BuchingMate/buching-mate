import { describe, expect, test } from "bun:test";
import { addUserToOrg, signUpAndCreateOrg } from "../../test/helpers/auth";
import { asJson, req } from "../../test/helpers/request";

const validEvent = {
  title: "Yoga Class",
  date: "2026-06-01",
  time: "10:00:00",
  duration: 60,
};

describe("POST /api/events", () => {
  test("should return 401 when the user is not signed in", async () => {
    const res = await req("/api/events", { method: "POST", body: validEvent });
    expect(res.status).toBe(401);
  });

  test("should return 403 when the user role is below manager", async () => {
    const fx = await signUpAndCreateOrg();
    const viewer = await addUserToOrg(fx.orgId, "viewer");
    const res = await req("/api/events", {
      method: "POST",
      body: validEvent,
      cookie: viewer.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("should create the event in the user's org and return 201", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: validEvent,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(201);
    const body = await asJson<{ event: { id: string; orgId: string; title: string } }>(res);
    expect(body.event.id).toBeTruthy();
    expect(body.event.orgId).toBe(fx.orgId);
    expect(body.event.title).toBe("Yoga Class");
  });

  test("should return 400 when the title is empty", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, title: "   " },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the duration is zero or less", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, duration: 0 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the price is negative", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, price: -100 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the price has decimals (price must be in cents)", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, price: 9.99 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should allow only 1 event per month on the free plan", async () => {
    const fx = await signUpAndCreateOrg();
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
    expect(second.status).toBe(402);
  });
});
