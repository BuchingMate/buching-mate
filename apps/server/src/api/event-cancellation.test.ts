import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../test/helpers/data";
import { asJson, req } from "../../test/helpers/request";

// PENDING SPEC — expected behavior when an EVENT (not a single registration) is
// cancelled. Today `updateEvent` only detaches the Zoom meeting; it does not
// guard new registrations or cascade to existing ones. These tests encode the
// requirement and currently FAIL, so they are skipped to keep CI green. Remove
// `.skip` to drive the implementation (TDD red → green). See TESTING_GAPS.md.
describe.skip("event cancellation (pending spec)", () => {
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
