import { describe, expect, test } from "bun:test";
import { addUserToOrg, signUpAndCreateOrg, signUpUser } from "../../test/helpers/auth";
import { asJson, req } from "../../test/helpers/request";

const validResource = {
  type: "instructor",
  name: "Jane Doe",
  email: "jane@example.com",
};

describe("POST /api/resources", () => {
  test("401 without session", async () => {
    const res = await req("/api/resources", { method: "POST", body: validResource });
    expect(res.status).toBe(401);
  });

  test("403 when authed user has no org membership", async () => {
    const owner = await signUpAndCreateOrg();
    const orphan = await signUpUser();
    const res = await req("/api/resources", {
      method: "POST",
      body: validResource,
      cookie: orphan.cookie,
    });
    expect(res.status).toBe(403);
    // Sanity: owner is unaffected
    expect(owner.orgId).toBeTruthy();
  });

  test("403 when role is below manager", async () => {
    const fx = await signUpAndCreateOrg();
    const viewer = await addUserToOrg(fx.orgId, "viewer");
    const res = await req("/api/resources", {
      method: "POST",
      body: validResource,
      cookie: viewer.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("201 manager creates valid resource", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: validResource,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(201);
    const body = await asJson<{ resource: { id: string; orgId: string; name: string; metadata: Record<string, unknown> } }>(res);
    expect(body.resource.id).toBeTruthy();
    expect(body.resource.orgId).toBe(fx.orgId);
    expect(body.resource.name).toBe("Jane Doe");
    expect(body.resource.metadata).toEqual({});
  });

  test("resource isolated to creating org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();

    await req("/api/resources", {
      method: "POST",
      body: { ...validResource, name: "OnlyInA" },
      cookie: a.cookie,
      orgId: a.orgId,
    });

    const listB = await req("/api/resources", { cookie: b.cookie, orgId: b.orgId });
    const body = await asJson<{ resources: Array<{ name: string }> }>(listB);
    expect(body.resources.find((r) => r.name === "OnlyInA")).toBeUndefined();
  });

  test("400 invalid type", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, type: "nonsense" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("400 blank name", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, name: "  " },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("400 float capacity", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, capacity: 1.5 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("400 negative cost", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, cost: -5 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("400 currency not 3-letter ISO", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, currency: "DOLLAR" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("cost number coerced to 2-decimal string, currency upper-cased", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, cost: 10, currency: "usd" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(201);
    const body = await asJson<{ resource: { cost: string; currency: string } }>(res);
    expect(body.resource.cost).toBe("10.00");
    expect(body.resource.currency).toBe("USD");
  });
});
