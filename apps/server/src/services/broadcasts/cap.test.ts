import { describe, expect, test } from "bun:test";
import {
  baseWeeklySends,
  BROADCAST_TIERS,
  FREE_WEEKLY_SENDS,
  TEAM_INCLUDED_WEEKLY_SENDS,
} from "@workspace/contracts";
import { exceedsWeeklyCap, isBillableAudience } from "./index";

describe("exceedsWeeklyCap", () => {
  test("should allow sending right up to the cap", () => {
    expect(exceedsWeeklyCap(500, 0, 500)).toBe(false);
  });

  test("should block sending one past the cap", () => {
    expect(exceedsWeeklyCap(500, 500, 1)).toBe(true);
  });

  test("should block when the next batch overflows part-way through the week", () => {
    expect(exceedsWeeklyCap(500, 490, 11)).toBe(true);
    expect(exceedsWeeklyCap(500, 490, 10)).toBe(false);
  });
});

describe("isBillableAudience", () => {
  test("should treat an all-attendee blast as billable", () => {
    expect(isBillableAudience({ type: "all_attendees" })).toBe(true);
  });

  test("should treat a send to an event's own guests as free", () => {
    expect(isBillableAudience({ type: "event_guests", eventId: "e1" })).toBe(false);
  });
});

describe("baseWeeklySends", () => {
  test("should give free orgs the free weekly allowance", () => {
    expect(baseWeeklySends("free")).toBe(FREE_WEEKLY_SENDS);
  });

  test("should give team orgs the included weekly allowance", () => {
    expect(baseWeeklySends("team")).toBe(TEAM_INCLUDED_WEEKLY_SENDS);
  });

  test("should give enterprise orgs an effectively unlimited allowance", () => {
    expect(baseWeeklySends("enterprise")).toBeGreaterThan(1_000_000);
  });
});

describe("BROADCAST_TIERS", () => {
  test("should list tiers whose caps rise above the team base", () => {
    for (const tier of BROADCAST_TIERS) {
      expect(tier.weeklyCap).toBeGreaterThan(TEAM_INCLUDED_WEEKLY_SENDS);
    }
  });
});
