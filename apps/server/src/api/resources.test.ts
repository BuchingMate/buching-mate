import { describe, expect, test } from "bun:test";
import { addUserToOrg, signUpAndCreateOrg, signUpUser } from "../../test/helpers/auth";
import { asJson, req } from "../../test/helpers/request";

const validResource = {
  type: "instructor",
  name: "Jane Doe",
  email: "jane@example.com",
};

describe("POST /api/resources", () => {
  test("should return 401 when the user is not signed in", async () => {
    const res = await req("/api/resources", { method: "POST", body: validResource });
    expect(res.status).toBe(401);
  });

  test("should return 403 when the user does not belong to any org", async () => {
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

  test("should return 403 when the user role is below manager", async () => {
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

  test("should create the resource and return 201 when a manager sends valid data", async () => {
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

  test("should keep a resource visible only to the org that created it", async () => {
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

  test("should return 400 when the resource type is not allowed", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, type: "nonsense" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the name is empty", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, name: "  " },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the capacity has decimals", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, capacity: 1.5 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the cost is negative", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, cost: -5 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the currency is not a 3-letter code", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/resources", {
      method: "POST",
      body: { ...validResource, currency: "DOLLAR" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should save the cost with 2 decimals and the currency in uppercase", async () => {
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
