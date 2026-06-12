import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import {
  isSubscribed,
  listCalendarSubscribers,
  subscribeToCalendar,
  unsubscribeFromCalendar,
} from "./index";

describe("calendar subscriptions", () => {
  test("subscribe is idempotent and case-insensitive on email", async () => {
    const { orgId } = await signUpAndCreateOrg();
    await subscribeToCalendar({ orgId, email: "Ada@Example.com" });
    await subscribeToCalendar({ orgId, email: "ada@example.com" });

    const subs = await listCalendarSubscribers(orgId);
    expect(subs).toHaveLength(1);
    expect(subs[0].email).toBe("ada@example.com");
    expect(await isSubscribed(orgId, "ADA@example.com")).toBe(true);
  });

  test("unsubscribe drops the address from the audience but keeps a row", async () => {
    const { orgId } = await signUpAndCreateOrg();
    await subscribeToCalendar({ orgId, email: "a@b.com" });
    await unsubscribeFromCalendar({ orgId, email: "a@b.com" });

    expect(await isSubscribed(orgId, "a@b.com")).toBe(false);
    expect(await listCalendarSubscribers(orgId)).toHaveLength(0);

    // Re-subscribing flips the same row back on.
    await subscribeToCalendar({ orgId, email: "a@b.com" });
    expect(await isSubscribed(orgId, "a@b.com")).toBe(true);
  });

  test("subscriptions are scoped per org", async () => {
    const { orgId: orgA } = await signUpAndCreateOrg();
    const { orgId: orgB } = await signUpAndCreateOrg();
    await subscribeToCalendar({ orgId: orgA, email: "x@y.com" });

    expect(await isSubscribed(orgA, "x@y.com")).toBe(true);
    expect(await isSubscribed(orgB, "x@y.com")).toBe(false);
  });
});
