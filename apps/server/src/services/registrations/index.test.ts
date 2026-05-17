import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../../test/helpers/data";
import { createRegistration } from "./index";

describe("createRegistration", () => {
  test("should return event_not_found when the event does not exist", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const attendee = await seedAttendee(orgId);

    const result = await createRegistration(orgId, {
      eventId: "00000000-0000-0000-0000-000000000000",
      attendeeId: attendee.id,
    });

    expect(result).toBe("event_not_found");
  });

  test("should return event_not_found when the event is in a different org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const eventInA = await seedEvent(a.orgId);
    const attendeeInB = await seedAttendee(b.orgId);

    const result = await createRegistration(b.orgId, {
      eventId: eventInA.id,
      attendeeId: attendeeInB.id,
    });

    expect(result).toBe("event_not_found");
  });

  test("should return attendee_not_found when the attendee is not in the org", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId);

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: "00000000-0000-0000-0000-000000000000",
    });

    expect(result).toBe("attendee_not_found");
  });

  test("should confirm the registration right away for a free event", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 0 });
    const attendee = await seedAttendee(orgId);

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: attendee.id,
    });

    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;
    expect(result.type).toBe("created");
    expect(result.registration.status).toBe("confirmed");
    expect(result.registration.paymentStatus).toBe("not_required");
  });

  test("should set the registration to pending for a paid event until payment is confirmed", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000 });
    const attendee = await seedAttendee(orgId);

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: attendee.id,
    });

    if (typeof result === "string") throw new Error(`expected created, got ${result}`);
    expect(result.type).toBe("created");
    expect(result.registration.status).toBe("pending");
    expect(result.registration.paymentStatus).toBe("pending");
  });

  test("should block a second active registration for the same event and attendee", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 0 });
    const attendee = await seedAttendee(orgId);
    await seedRegistration(orgId, event.id, attendee.id, { status: "confirmed" });

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: attendee.id,
    });

    expect(result).toBe("duplicate_registration");
  });

  test("should allow a new registration after the previous one was cancelled", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 0 });
    const attendee = await seedAttendee(orgId);
    await seedRegistration(orgId, event.id, attendee.id, { status: "cancelled" });

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: attendee.id,
    });

    if (typeof result === "string") throw new Error(`expected created, got ${result}`);
    expect(result.type).toBe("created");
  });

  test("should resume a pending registration that has not expired instead of making a new one", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000 });
    const attendee = await seedAttendee(orgId);
    const future = new Date(Date.now() + 10 * 60 * 1000);
    const prior = await seedRegistration(orgId, event.id, attendee.id, {
      status: "pending",
      paymentStatus: "pending",
      paymentExpiresAt: future,
    });

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: attendee.id,
    });

    if (typeof result === "string") throw new Error(`expected resume, got ${result}`);
    expect(result.type).toBe("resume");
    expect(result.registration.id).toBe(prior.id);
  });

  test("should add the registration to the waitlist when the event is full", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 0, maxCapacity: 1 });
    const first = await seedAttendee(orgId);
    const second = await seedAttendee(orgId);
    await seedRegistration(orgId, event.id, first.id, { status: "confirmed" });

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: second.id,
    });

    if (typeof result === "string") throw new Error(`expected created, got ${result}`);
    expect(result.registration.status).toBe("waitlisted");
  });

  test("should treat no capacity limit as unlimited spots", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 0, maxCapacity: null });
    const attendees = await Promise.all([
      seedAttendee(orgId),
      seedAttendee(orgId),
      seedAttendee(orgId),
    ]);
    for (const a of attendees.slice(0, 2)) {
      await seedRegistration(orgId, event.id, a.id, { status: "confirmed" });
    }

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: attendees[2].id,
    });

    if (typeof result === "string") throw new Error(`expected created, got ${result}`);
    expect(result.registration.status).toBe("confirmed");
  });

  test("should hold a seat for a pending registration so it counts towards capacity", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000, maxCapacity: 1 });
    const first = await seedAttendee(orgId);
    const second = await seedAttendee(orgId);
    await seedRegistration(orgId, event.id, first.id, {
      status: "pending",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const result = await createRegistration(orgId, {
      eventId: event.id,
      attendeeId: second.id,
    });

    if (typeof result === "string") throw new Error(`expected created, got ${result}`);
    expect(result.registration.status).toBe("waitlisted");
  });
});
