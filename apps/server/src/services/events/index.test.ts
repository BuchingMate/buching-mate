import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import {
  seedAttendee,
  seedEvent,
  seedRegistration,
  seedResource,
} from "../../../test/helpers/data";
import { duplicateEvent, getEvent, listEvents, replaceEventResources } from "./index";

describe("listEvents / getEvent counts", () => {
  test("should count pending registrations as confirmed and count waitlisted separately", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { maxCapacity: 5 });
    const [a, b, c, d, e] = await Promise.all([
      seedAttendee(orgId),
      seedAttendee(orgId),
      seedAttendee(orgId),
      seedAttendee(orgId),
      seedAttendee(orgId),
    ]);
    await seedRegistration(orgId, event.id, a.id, { status: "confirmed" });
    await seedRegistration(orgId, event.id, b.id, { status: "confirmed" });
    await seedRegistration(orgId, event.id, c.id, { status: "pending", paymentStatus: "pending" });
    await seedRegistration(orgId, event.id, d.id, { status: "waitlisted" });
    await seedRegistration(orgId, event.id, e.id, { status: "cancelled" });

    const list = await listEvents(orgId);
    const found = list.find((evt) => evt.id === event.id);
    expect(found).toBeDefined();
    expect(found!.confirmedRegistrations).toBe(3); // 2 confirmed + 1 pending
    expect(found!.waitlistedRegistrations).toBe(1);

    const single = await getEvent(orgId, event.id);
    expect(single!.confirmedRegistrations).toBe(3);
    expect(single!.waitlistedRegistrations).toBe(1);
  });

  test("should return zero counts for an event with no registrations", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId);
    const list = await listEvents(orgId);
    const found = list.find((evt) => evt.id === event.id);
    expect(found!.confirmedRegistrations).toBe(0);
    expect(found!.waitlistedRegistrations).toBe(0);
  });

  test("should not count registrations from other orgs", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const eventA = await seedEvent(a.orgId);
    const eventB = await seedEvent(b.orgId);
    const attendeeA = await seedAttendee(a.orgId);
    const attendeeB = await seedAttendee(b.orgId);
    await seedRegistration(a.orgId, eventA.id, attendeeA.id, { status: "confirmed" });
    await seedRegistration(b.orgId, eventB.id, attendeeB.id, { status: "confirmed" });

    const single = await getEvent(a.orgId, eventA.id);
    expect(single!.confirmedRegistrations).toBe(1);
  });

  test("should return null when fetching an event from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const eventA = await seedEvent(a.orgId);
    const result = await getEvent(b.orgId, eventA.id);
    expect(result).toBeNull();
  });
});

describe("duplicateEvent", () => {
  test("should return null when the source event does not exist", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const result = await duplicateEvent(orgId, userId, "00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  test("should return null when trying to duplicate an event from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const eventInA = await seedEvent(a.orgId);
    const result = await duplicateEvent(b.orgId, b.userId, eventInA.id);
    expect(result).toBeNull();
  });

  test("should copy the fields, add ' Copy' to the title, and set the visibility to unpublished", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const source = await seedEvent(orgId, {
      title: "Original",
      price: 5000,
      maxCapacity: 10,
      visibility: "published",
      tags: ["yoga", "morning"],
    });

    const dup = await duplicateEvent(orgId, userId, source.id);
    expect(dup).not.toBeNull();
    expect(dup!.title).toBe("Original Copy");
    expect(dup!.id).not.toBe(source.id);
    expect(dup!.visibility).toBe("unpublished");
    expect(dup!.price).toBe(5000);
    expect(dup!.maxCapacity).toBe(10);
    expect(dup!.tags).toEqual(["yoga", "morning"]);
  });
});

describe("replaceEventResources", () => {
  test("should return event_not_found when the target event does not exist", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const result = await replaceEventResources(orgId, "00000000-0000-0000-0000-000000000000", []);
    expect(result).toBe("event_not_found");
  });

  test("should return resource_not_found when an assigned resource is from another org", async () => {
    const a = await signUpAndCreateOrg();
    const b = await signUpAndCreateOrg();
    const eventInA = await seedEvent(a.orgId);
    const resourceInB = await seedResource(b.orgId);

    const result = await replaceEventResources(a.orgId, eventInA.id, [
      { resourceId: resourceInB.id, role: "instructor" },
    ]);
    expect(result).toBe("resource_not_found");
  });

  test("should remove all resource assignments when the list is empty", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId);
    const resource = await seedResource(orgId);
    await replaceEventResources(orgId, event.id, [{ resourceId: resource.id, role: "instructor" }]);

    const result = await replaceEventResources(orgId, event.id, []);
    expect(result).toEqual([]);
  });

  test("should replace the existing resource assignments with the new list", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId);
    const r1 = await seedResource(orgId, { name: "R1" });
    const r2 = await seedResource(orgId, { name: "R2" });

    await replaceEventResources(orgId, event.id, [{ resourceId: r1.id, role: "instructor" }]);
    const replaced = await replaceEventResources(orgId, event.id, [
      { resourceId: r2.id, role: "location", quantity: 3 },
    ]);

    if (typeof replaced === "string") throw new Error(`expected array, got ${replaced}`);
    expect(replaced).toHaveLength(1);
    expect(replaced[0].resourceId).toBe(r2.id);
    expect(replaced[0].role).toBe("location");
    expect(replaced[0].quantity).toBe(3);
  });

  test("should allow the same resource to fill multiple roles in one request", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId);
    const resource = await seedResource(orgId);

    const result = await replaceEventResources(orgId, event.id, [
      { resourceId: resource.id, role: "instructor" },
      { resourceId: resource.id, role: "assistant" },
    ]);

    if (typeof result === "string") throw new Error(`expected array, got ${result}`);
    expect(result).toHaveLength(2);
  });
});
