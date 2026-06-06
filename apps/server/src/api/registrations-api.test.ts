import { describe, expect, test } from "bun:test";
import { addUserToOrg, signUpAndCreateOrg, signUpUser } from "../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../test/helpers/data";
import { asJson, req } from "../../test/helpers/request";

async function orgWithEventAndAttendee() {
  const fx = await signUpAndCreateOrg();
  const event = await seedEvent(fx.orgId, { maxCapacity: 10 });
  const attendee = await seedAttendee(fx.orgId);
  return { fx, event, attendee };
}

describe("POST /api/registrations", () => {
  test("should return 401 when not signed in", async () => {
    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: "x", attendeeId: "y" },
    });
    expect(res.status).toBe(401);
  });

  test("should return 403 when the user role is below manager", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const viewer = await addUserToOrg(fx.orgId, "viewer");
    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: event.id, attendeeId: attendee.id },
      cookie: viewer.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("should return 400 when required ids are missing", async () => {
    const fx = await signUpAndCreateOrg();
    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: "" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 when the event does not exist", async () => {
    const { fx, attendee } = await orgWithEventAndAttendee();
    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: "00000000-0000-0000-0000-000000000000", attendeeId: attendee.id },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(404);
    const body = await asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("event_not_found");
  });

  test("should return 404 when the attendee is from another org", async () => {
    const { fx, event } = await orgWithEventAndAttendee();
    const other = await signUpAndCreateOrg();
    const foreignAttendee = await seedAttendee(other.orgId);
    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: event.id, attendeeId: foreignAttendee.id },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(404);
    const body = await asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("attendee_not_found");
  });

  test("should create the registration and return 201", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: event.id, attendeeId: attendee.id },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(201);
    const body = await asJson<{ registration: { eventId: string; status: string } }>(res);
    expect(body.registration.eventId).toBe(event.id);
  });

  test("should return 409 when the same attendee is already actively registered", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    await seedRegistration(fx.orgId, event.id, attendee.id, { status: "confirmed" });
    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: event.id, attendeeId: attendee.id },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(409);
    const body = await asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("duplicate_registration");
  });
});

describe("PATCH /api/registrations/:registrationId", () => {
  test("should let a manager cancel a registration", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id, { status: "confirmed" });
    const manager = await addUserToOrg(fx.orgId, "manager");
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "PATCH",
      body: { status: "cancelled" },
      cookie: manager.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ registration: { status: string } }>(res);
    expect(body.registration.status).toBe("cancelled");
  });

  test("should update the payment status (mark paid)", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id, {
      status: "pending",
      paymentStatus: "pending",
    });
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "PATCH",
      body: { paymentStatus: "paid" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ registration: { paymentStatus: string } }>(res);
    expect(body.registration.paymentStatus).toBe("paid");
  });

  test("should return 400 for an invalid status value", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id);
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "PATCH",
      body: { status: "nonsense" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 400 when no fields are provided", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id);
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "PATCH",
      body: {},
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(400);
  });

  test("should return 404 when updating a registration from another org", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id);
    const other = await signUpAndCreateOrg();
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "PATCH",
      body: { status: "cancelled" },
      cookie: other.cookie,
      orgId: other.orgId,
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/registrations/:registrationId", () => {
  test("should return 403 for a manager (admin required)", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id);
    const manager = await addUserToOrg(fx.orgId, "manager");
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "DELETE",
      cookie: manager.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(403);
  });

  test("should let an admin delete the registration", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id);
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "DELETE",
      cookie: fx.cookie,
      orgId: fx.orgId,
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ deleted: boolean }>(res);
    expect(body.deleted).toBe(true);
  });

  test("should return 404 when deleting a registration from another org", async () => {
    const { fx, event, attendee } = await orgWithEventAndAttendee();
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id);
    const other = await signUpAndCreateOrg();
    const res = await req(`/api/registrations/${reg.id}`, {
      method: "DELETE",
      cookie: other.cookie,
      orgId: other.orgId,
    });
    expect(res.status).toBe(404);
  });
});
