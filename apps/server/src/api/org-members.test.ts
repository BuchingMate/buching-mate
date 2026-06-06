import { describe, expect, test } from "bun:test";
import { addUserToOrg, getMemberId, signUpAndCreateOrg, signUpUser } from "../../test/helpers/auth";
import { asJson, req } from "../../test/helpers/request";

describe("GET /api/org/members", () => {
  test("should return 401 when not signed in", async () => {
    const res = await req("/api/org/members");
    expect(res.status).toBe(401);
  });

  test("should list the owner and added members", async () => {
    const fx = await signUpAndCreateOrg();
    const member = await addUserToOrg(fx.orgId, "manager");
    const res = await req("/api/org/members", { cookie: fx.cookie, orgId: fx.orgId });
    expect(res.status).toBe(200);
    const body = await asJson<{ members: Array<{ id: string }> }>(res);
    const ids = body.members.map((m) => m.id);
    expect(ids).toContain(member.memberId);
    expect(body.members.length).toBeGreaterThanOrEqual(2);
  });
});

describe("PATCH /api/org/members/:memberId", () => {
  test("should return 403 when the caller is below admin", async () => {
    const fx = await signUpAndCreateOrg();
    const target = await addUserToOrg(fx.orgId, "viewer");
    const manager = await addUserToOrg(fx.orgId, "manager");
    const res = await req(`/api/org/members/${target.memberId}`, {
      method: "PATCH",
      body: { role: "manager" },
      cookie: manager.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("should let an admin promote a viewer to manager", async () => {
    const fx = await signUpAndCreateOrg();
    const target = await addUserToOrg(fx.orgId, "viewer");
    const res = await req(`/api/org/members/${target.memberId}`, {
      method: "PATCH",
      body: { role: "manager" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ updated: boolean }>(res);
    expect(body.updated).toBe(true);
  });

  test("should return 400 for an invalid role", async () => {
    const fx = await signUpAndCreateOrg();
    const target = await addUserToOrg(fx.orgId, "viewer");
    const res = await req(`/api/org/members/${target.memberId}`, {
      method: "PATCH",
      body: { role: "superadmin" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 for an unknown member", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req(`/api/org/members/00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      body: { role: "manager" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(404);
  });

  test("should return 404 for a member id from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const target = await addUserToOrg(b.orgId, "viewer");
    const res = await req(`/api/org/members/${target.memberId}`, {
      method: "PATCH",
      body: { role: "manager" },
      cookie: a.cookie,
      orgId: a.orgId,
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/org/members/:memberId", () => {
  test("should return 403 when the caller is below admin", async () => {
    const fx = await signUpAndCreateOrg();
    const target = await addUserToOrg(fx.orgId, "viewer");
    const manager = await addUserToOrg(fx.orgId, "manager");
    const res = await req(`/api/org/members/${target.memberId}`, {
      method: "DELETE",
      cookie: manager.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("should let an admin remove a member", async () => {
    const fx = await signUpAndCreateOrg();
    const target = await addUserToOrg(fx.orgId, "viewer");
    const res = await req(`/api/org/members/${target.memberId}`, {
      method: "DELETE",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ deleted: boolean }>(res);
    expect(body.deleted).toBe(true);
  });

  test("should refuse to remove the owner with 400", async () => {
    const fx = await signUpAndCreateOrg();
    const ownerMemberId = await getMemberId(fx.orgId, fx.userId);
    const res = await req(`/api/org/members/${ownerMemberId}`, {
      method: "DELETE",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
    const body = await asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("cannot_remove_owner");
  });

  test("should return 404 for a member id from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const target = await addUserToOrg(b.orgId, "viewer");
    const res = await req(`/api/org/members/${target.memberId}`, {
      method: "DELETE",
      cookie: a.cookie,
      orgId: a.orgId,
    });
    expect(res.status).toBe(404);
  });
});

describe("org member endpoints — misc", () => {
  test("GET /api/org/seats returns seat usage shape", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/org/seats", { cookie: fx.cookie, orgId: fx.orgId });
    expect(res.status).toBe(200);
  });

  test("POST /api/org/invites is not implemented yet (501)", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/org/invites", {
      method: "POST",
      body: { email: "new@example.com", role: "manager" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(501);
  });

  test("a signed-out user cannot reach members", async () => {
    const stranger = await signUpUser();
    const res = await req("/api/org/members", { cookie: stranger.cookie });
    expect(res.status).toBe(403);
  });
});
