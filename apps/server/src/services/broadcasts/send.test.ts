import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { orgSettings } from "../../db/schema";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../../test/helpers/data";
import { getOrgSettings } from "../org";
import { subscribeToCalendar, unsubscribeFromCalendar } from "../calendar";
import { getUsage, incrementUsage, weekStart } from "../subscription-usage";
import { createBroadcast, sendBroadcast } from "./index";

async function setAddonCap(orgId: string, cap: number | null) {
  await getOrgSettings(orgId); // ensure the row exists
  await db.update(orgSettings).set({ broadcastWeeklyCap: cap }).where(eq(orgSettings.orgId, orgId));
}

// Subscribe `count` synthetic emails to the org's Calendar and return them.
async function subscribe(orgId: string, count: number): Promise<string[]> {
  const emails: string[] = [];
  for (let i = 0; i < count; i++) {
    const email = `sub-${orgId.slice(0, 6)}-${i}-${Math.floor(performance.now())}@example.com`;
    await subscribeToCalendar({ orgId, email, source: "org_page" });
    emails.push(email);
  }
  return emails;
}

async function draftToSubscribers(orgId: string) {
  const draft = await createBroadcast(orgId, {
    kind: "newsletter",
    subject: "Hello",
    bodyHtml: "<p>Hi</p>",
    audience: { type: "calendar_subscribers" },
  });
  if (typeof draft === "string") throw new Error(draft);
  return draft;
}

describe("sendBroadcast", () => {
  test("should count a Calendar-subscriber broadcast toward weekly usage", async () => {
    const { orgId } = await signUpAndCreateOrg();
    await subscribe(orgId, 2);

    const draft = await draftToSubscribers(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("sent");
    expect(await getUsage(orgId, "broadcast_sends", weekStart())).toBe(2);
  });

  test("should not send to an unsubscribed address", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const [a] = await subscribe(orgId, 2);
    await unsubscribeFromCalendar({ orgId, email: a });

    const draft = await draftToSubscribers(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("sent");
    // Two subscribed, one unsubscribed: only one remains in the audience.
    expect(await getUsage(orgId, "broadcast_sends", weekStart())).toBe(1);
  });

  test("should report no recipients when the org has no subscribers", async () => {
    const { orgId } = await signUpAndCreateOrg();

    const draft = await draftToSubscribers(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("no_recipients");
  });

  test("should not require an address for a send to an event's own guests", async () => {
    const { orgId } = await signUpAndCreateOrg(); // no address set
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

  test("should block a Calendar-subscriber broadcast that crosses the weekly cap", async () => {
    const { orgId } = await signUpAndCreateOrg(); // free plan, cap 500
    await subscribe(orgId, 1);
    await incrementUsage(db, orgId, "broadcast_sends", weekStart(), 500);

    const draft = await draftToSubscribers(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("cap_exceeded");
    if (result.type === "cap_exceeded") {
      expect(result.limit).toBe(500);
      expect(result.used).toBe(500);
    }
  });

  test("should allow sending past the base cap when an add-on raises it", async () => {
    const { orgId } = await signUpAndCreateOrg();
    await subscribe(orgId, 1);
    await setAddonCap(orgId, 10_000);
    await incrementUsage(db, orgId, "broadcast_sends", weekStart(), 600); // over free 500

    const draft = await draftToSubscribers(orgId);
    const result = await sendBroadcast(orgId, draft.id);

    expect(result.type).toBe("sent");
    expect(await getUsage(orgId, "broadcast_sends", weekStart())).toBe(601);
  });
});
