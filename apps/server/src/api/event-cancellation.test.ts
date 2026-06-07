import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../test/helpers/data";
import { asJson, req } from "../../test/helpers/request";

// Expected behavior when an EVENT (not a single registration) is cancelled:
// new registrations are refused and existing active ones cascade to cancelled
// (with attendee notification emails — covered in events/email tests).
describe("event cancellation", () => {
  test("should reject a new registration for a cancelled event", async () => {
    const fx = await signUpAndCreateOrg();
    const event = await seedEvent(fx.orgId, { status: "cancelled", maxCapacity: 10 });
    const attendee = await seedAttendee(fx.orgId);

    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: event.id, attendeeId: attendee.id },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });

    // Expected: booking a cancelled event is refused, not silently created.
    expect(res.status).toBe(409);
    const body = await asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("event_not_bookable");
  });

  test("should cancel existing registrations when the event is cancelled", async () => {
    const fx = await signUpAndCreateOrg();
    const event = await seedEvent(fx.orgId, { status: "upcoming", maxCapacity: 10 });
    const attendee = await seedAttendee(fx.orgId);
    const reg = await seedRegistration(fx.orgId, event.id, attendee.id, { status: "confirmed" });

    await req(`/api/events/${event.id}`, {
      method: "PATCH",
      body: { status: "cancelled" },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });

    // Expected: the attendee's registration reflects the cancellation.
    const list = await req("/api/registrations", { cookie: fx.cookie, orgId: fx.orgId });
    const body = await asJson<{ registrations: Array<{ id: string; status: string }> }>(list);
    const updated = body.registrations.find((r) => r.id === reg.id);
    expect(updated?.status).toBe("cancelled");
  });

  test("should reject a registration for a completed event too", async () => {
    const fx = await signUpAndCreateOrg();
    const event = await seedEvent(fx.orgId, { status: "completed", maxCapacity: 10 });
    const attendee = await seedAttendee(fx.orgId);

    const res = await req("/api/registrations", {
      method: "POST",
      body: { eventId: event.id, attendeeId: attendee.id },
      cookie: fx.cookie,
      orgId: fx.orgId,
    });

    expect(res.status).toBe(409);
  });
});
