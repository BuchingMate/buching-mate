import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orgSettings } from "../../db/schema";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../../test/helpers/data";
import { getOrgSettings } from "../org";
import { getUsage, incrementUsage, weekStart } from "../subscription-usage";
import { createBroadcast, sendBroadcast } from "./index";

async function setAddonCap(orgId: string, cap: number | null) {
  await getOrgSettings(orgId); // ensure the row exists
  await db.update(orgSettings).set({ broadcastWeeklyCap: cap }).where(eq(orgSettings.orgId, orgId));
}

async function draftAllAttendees(orgId: string) {
  const draft = await createBroadcast(orgId, {
    kind: "newsletter",
    subject: "Hello",
    bodyHtml: "<p>Hi</p>",
    audience: { type: "all_attendees" },
  });
  if (typeof draft === "string") throw new Error(draft);
  return draft;
}

describe("sendBroadcast", () => {
  test("should count an all-attendee broadcast toward weekly usage", async () => {
    const { orgId } = await signUpAndCreateOrg();
    await seedAttendee(orgId);
    await seedAttendee(orgId);

    const draft = await draftAllAttendees(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("sent");
    expect(await getUsage(orgId, "broadcast_sends", weekStart())).toBe(2);
  });

  test("should not count a send to an event's own guests", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId);
    const attendee = await seedAttendee(orgId);
    await seedRegistration(orgId, event.id, attendee.id, { status: "confirmed" });

    const draft = await createBroadcast(orgId, {
      kind: "invitation",
      subject: "Join us",
      bodyHtml: "<p>Come</p>",
      audience: { type: "event_guests", eventId: event.id },
    });
    if (typeof draft === "string") throw new Error(draft);

    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("sent");
    expect(await getUsage(orgId, "broadcast_sends", weekStart())).toBe(0);
  });

  test("should block an all-attendee broadcast that crosses the weekly cap", async () => {
    const { orgId } = await signUpAndCreateOrg(); // free plan, cap 500
    await seedAttendee(orgId);
    await incrementUsage(db, orgId, "broadcast_sends", weekStart(), 500);

    const draft = await draftAllAttendees(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("cap_exceeded");
    if (result.type === "cap_exceeded") {
      expect(result.limit).toBe(500);
      expect(result.used).toBe(500);
    }
  });

  test("should allow sending past the base cap when an add-on raises it", async () => {
    const { orgId } = await signUpAndCreateOrg();
    await seedAttendee(orgId);
    await setAddonCap(orgId, 10_000);
    await incrementUsage(db, orgId, "broadcast_sends", weekStart(), 600); // over free 500

    const draft = await draftAllAttendees(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("sent");
    expect(await getUsage(orgId, "broadcast_sends", weekStart())).toBe(601);
  });
});
