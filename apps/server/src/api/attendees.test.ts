import { describe, expect, test } from "bun:test";
import { addUserToOrg, signUpAndCreateOrg, signUpUser } from "../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../test/helpers/data";
import { asJson, req } from "../../test/helpers/request";

const validAttendee = { name: "Jane Doe", email: "Jane@Example.com", phone: "+15551234567" };

describe("POST /api/attendees", () => {
  test("should return 401 when the user is not signed in", async () => {
    const res = await req("/api/attendees", { method: "POST", body: validAttendee });
    expect(res.status).toBe(401);
  });

  test("should return 403 when the user does not belong to any org", async () => {
    const orphan = await signUpUser();
    const res = await req("/api/attendees", {
      method: "POST",
      body: validAttendee,
      cookie: orphan.cookie,
    });
    expect(res.status).toBe(403);
  });

  test("should return 403 when the user role is below manager", async () => {
    const fx = await signUpAndCreateOrg();
    const viewer = await addUserToOrg(fx.orgId, "viewer");
    const res = await req("/api/attendees", {
      method: "POST",
      body: validAttendee,
      cookie: viewer.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("should create the attendee and lowercase the email when a manager sends valid data", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/attendees", {
      method: "POST",
      body: validAttendee,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(201);
    const body = await asJson<{ attendee: { id: string; orgId: string; email: string } }>(res);
    expect(body.attendee.id).toBeTruthy();
    expect(body.attendee.orgId).toBe(fx.orgId);
    expect(body.attendee.email).toBe("jane@example.com");
  });

  test("should return 400 when the name is empty", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/attendees", {
      method: "POST",
      body: { ...validAttendee, name: "   " },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the email is empty", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/attendees", {
      method: "POST",
      body: { ...validAttendee, email: "" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when the phone is not a string or null", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/attendees", {
      method: "POST",
      body: { ...validAttendee, phone: 12345 },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  // EDGE: (orgId, email) is unique; a duplicate create returns a clean 409.
  test("should return 409 for a second attendee with the same email in the same org", async () => {
    const fx = await signUpAndCreateOrg();
    const first = await req("/api/attendees", {
      method: "POST",
      body: validAttendee,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(first.status).toBe(201);
    const second = await req("/api/attendees", {
      method: "POST",
      body: validAttendee,
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(second.status).toBe(409);
    const body = await asJson<{ error: { code: string } }>(second);
    expect(body.error.code).toBe("duplicate_attendee");
  });
});

describe("GET /api/attendees", () => {
  test("should list only the org's own attendees", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    await seedAttendee(a.orgId, { name: "OnlyInA", email: "onlyina@example.com" });

    const res = await req("/api/attendees", { cookie: b.cookie, orgId: b.orgId });
    const body = await asJson<{ attendees: Array<{ name: string }> }>(res);
    expect(body.attendees.find((x) => x.name === "OnlyInA")).toBeUndefined();
  });

  test("should filter by the search query against name and email", async () => {
    const fx = await signUpAndCreateOrg();
    await seedAttendee(fx.orgId, { name: "Findme Smith", email: "findme@example.com" });
    await seedAttendee(fx.orgId, { name: "Other Person", email: "other@example.com" });

    const res = await req("/api/attendees?search=findme", { cookie: fx.cookie, orgId: fx.orgId });
    const body = await asJson<{ attendees: Array<{ name: string }> }>(res);
    expect(body.attendees.length).toBe(1);
    expect(body.attendees[0].name).toBe("Findme Smith");
  });
});

describe("GET /api/attendees/:attendeeId", () => {
  test("should return 404 when reading an attendee from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const att = await seedAttendee(a.orgId);
    const res = await req(`/api/attendees/${att.id}`, { cookie: b.cookie, orgId: b.orgId });
    expect(res.status).toBe(404);
  });

  test("should return the attendee for its own org", async () => {
    const fx = await signUpAndCreateOrg();
    const att = await seedAttendee(fx.orgId);
    const res = await req(`/api/attendees/${att.id}`, { cookie: fx.cookie, orgId: fx.orgId });
    expect(res.status).toBe(200);
    const body = await asJson<{ attendee: { id: string } }>(res);
    expect(body.attendee.id).toBe(att.id);
  });
});

describe("PATCH /api/attendees/:attendeeId", () => {
  test("should return 403 when the user role is below manager", async () => {
    const fx = await signUpAndCreateOrg();
    const att = await seedAttendee(fx.orgId);
    const viewer = await addUserToOrg(fx.orgId, "viewer");
    const res = await req(`/api/attendees/${att.id}`, {
      method: "PATCH",
      body: { name: "New Name" },
      cookie: viewer.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("should update the name and lowercase a new email", async () => {
    const fx = await signUpAndCreateOrg();
    const att = await seedAttendee(fx.orgId);
    const res = await req(`/api/attendees/${att.id}`, {
      method: "PATCH",
      body: { name: "Renamed", email: "NEW@Example.com" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ attendee: { name: string; email: string } }>(res);
    expect(body.attendee.name).toBe("Renamed");
    expect(body.attendee.email).toBe("new@example.com");
  });

  test("should return 400 when no fields are provided", async () => {
    const fx = await signUpAndCreateOrg();
    const att = await seedAttendee(fx.orgId);
    const res = await req(`/api/attendees/${att.id}`, {
      method: "PATCH",
      body: {},
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 when updating an attendee from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const att = await seedAttendee(a.orgId);
    const res = await req(`/api/attendees/${att.id}`, {
      method: "PATCH",
      body: { name: "Hijack" },
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/attendees/:attendeeId/registrations", () => {
  test("should list the attendee's registrations", async () => {
    const fx = await signUpAndCreateOrg();
    const att = await seedAttendee(fx.orgId);
    const event = await seedEvent(fx.orgId);
    await seedRegistration(fx.orgId, event.id, att.id);

    const res = await req(`/api/attendees/${att.id}/registrations`, {
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ registrations: Array<{ eventId: string }> }>(res);
    expect(body.registrations.length).toBe(1);
    expect(body.registrations[0].eventId).toBe(event.id);
  });

  test("should return 404 for an attendee from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const att = await seedAttendee(a.orgId);
    const res = await req(`/api/attendees/${att.id}/registrations`, {
      cookie: b.cookie,
      orgId: b.orgId,
    });
    expect(res.status).toBe(404);
  });
});
