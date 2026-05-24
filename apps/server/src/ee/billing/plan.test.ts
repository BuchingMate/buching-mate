import { describe, expect, test } from "bun:test";
import { planFromProductId } from "./polar";
import { planFromMetadata } from "./webhook";

describe("planFromProductId", () => {
  test("should return null for a missing product id", () => {
    expect(planFromProductId(null)).toBeNull();
    expect(planFromProductId(undefined)).toBeNull();
  });

  test("should return null for an unrecognized product so it never clobbers the plan", () => {
    expect(planFromProductId("prod_not_a_plan")).toBeNull();
  });
});

describe("planFromMetadata", () => {
  test("should read a custom enterprise plan from subscription metadata", () => {
    expect(planFromMetadata({ plan: "enterprise" })).toBe("enterprise");
  });

  test("should read a team plan from metadata", () => {
    expect(planFromMetadata({ plan: "team" })).toBe("team");
  });

  test("should return null when metadata has no usable plan", () => {
    expect(planFromMetadata({})).toBeNull();
    expect(planFromMetadata({ plan: "free" })).toBeNull();
    expect(planFromMetadata(null)).toBeNull();
  });
});
