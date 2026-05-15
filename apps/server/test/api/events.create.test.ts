import { describe, expect, test } from "bun:test";
import { addUserToOrg, signUpAndCreateOrg } from "../helpers/auth";
import { asJson, req } from "../helpers/request";

const validEvent = {
  title: "Yoga Class",
  date: "2026-06-01",
  time: "10:00:00",
  duration: 60,
};

describe("POST /api/events", () => {
  test("401 without session", async () => {
    const res = await req("/api/events", { method: "POST", body: validEvent });
    expect(res.status).toBe(401);
  });

  test("403 viewer cannot create", async () => {
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

  test("201 manager creates valid event under correct org", async () => {
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

  test("400 blank title", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, title: "   " },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("400 non-positive duration", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, duration: 0 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("400 negative price", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, price: -100 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("400 non-integer price", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/events", {
      method: "POST",
      body: { ...validEvent, price: 9.99 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("free plan caps at 1 event per month", async () => {
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
