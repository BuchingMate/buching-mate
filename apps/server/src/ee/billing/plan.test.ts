import { describe, expect, test } from "bun:test";
import {
  isSeatedRole,
  parseTeamPricing,
  planFromProductId,
  seatCapForPlan,
  shouldSyncSeats,
} from "./polar";
import { mapStatus, planFromMetadata } from "./webhook";

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

describe("shouldSyncSeats", () => {
  test("should not sync free (not seat-billed)", () => {
    expect(
      shouldSyncSeats({ plan: "free", status: "active", storedSeats: 1, seatedCount: 5 }).sync,
    ).toBe(false);
  });

  test("should not sync when the subscription is not active or trialing", () => {
    for (const status of ["past_due", "canceled", "incomplete"]) {
      expect(shouldSyncSeats({ plan: "team", status, storedSeats: 1, seatedCount: 5 }).sync).toBe(
        false,
      );
    }
  });

  test("should floor team seats up to the seated count (upgrade with existing admins)", () => {
    expect(
      shouldSyncSeats({ plan: "team", status: "active", storedSeats: 3, seatedCount: 5 }),
    ).toEqual({ sync: true, seats: 5 });
    // Trialing behaves like active.
    expect(
      shouldSyncSeats({ plan: "team", status: "trialing", storedSeats: 1, seatedCount: 4 }),
    ).toEqual({ sync: true, seats: 4 });
  });

  test("should not lower team seats below the purchased count (customer may reserve)", () => {
    expect(
      shouldSyncSeats({ plan: "team", status: "active", storedSeats: 5, seatedCount: 2 }).sync,
    ).toBe(false);
  });

  test("should not sync team when members equal purchased seats", () => {
    expect(
      shouldSyncSeats({ plan: "team", status: "active", storedSeats: 3, seatedCount: 3 }).sync,
    ).toBe(false);
  });

  test("should pin enterprise seats to the contracted limit, reverting portal edits", () => {
    // Customer raised seats in the portal (20) — revert down to the contracted 10.
    expect(
      shouldSyncSeats({
        plan: "enterprise",
        status: "active",
        storedSeats: 20,
        seatedCount: 3,
        enterpriseSeatLimit: 10,
      }),
    ).toEqual({ sync: true, seats: 10 });
    // Polar drifted below the contract — push back up to 10.
    expect(
      shouldSyncSeats({
        plan: "enterprise",
        status: "active",
        storedSeats: 5,
        seatedCount: 3,
        enterpriseSeatLimit: 10,
      }),
    ).toEqual({ sync: true, seats: 10 });
  });

  test("should not sync enterprise when already at the contracted limit", () => {
    expect(
      shouldSyncSeats({
        plan: "enterprise",
        status: "active",
        storedSeats: 10,
        seatedCount: 3,
        enterpriseSeatLimit: 10,
      }).sync,
    ).toBe(false);
  });

  test("should leave enterprise seats alone when uncapped (no contract limit)", () => {
    expect(
      shouldSyncSeats({
        plan: "enterprise",
        status: "active",
        storedSeats: 7,
        seatedCount: 3,
        enterpriseSeatLimit: null,
      }).sync,
    ).toBe(false);
  });
});

describe("isSeatedRole", () => {
  test("should count owner and admin as seated", () => {
    expect(isSeatedRole("owner")).toBe(true);
    expect(isSeatedRole("admin")).toBe(true);
  });

  test("should not count manager or viewer", () => {
    expect(isSeatedRole("manager")).toBe(false);
    expect(isSeatedRole("viewer")).toBe(false);
  });
});

describe("seatCapForPlan", () => {
  test("free is a fixed hard cap of 3", () => {
    expect(seatCapForPlan({ plan: "free", teamSeats: 99, enterpriseSeatLimit: 99 })).toBe(3);
  });

  test("team uses purchased seats, falling back to the 5 included", () => {
    expect(seatCapForPlan({ plan: "team", teamSeats: 8, enterpriseSeatLimit: null })).toBe(8);
    expect(seatCapForPlan({ plan: "team", teamSeats: null, enterpriseSeatLimit: null })).toBe(5);
  });

  test("enterprise uses the contracted limit, uncapped when unset", () => {
    expect(seatCapForPlan({ plan: "enterprise", teamSeats: null, enterpriseSeatLimit: 25 })).toBe(
      25,
    );
    expect(seatCapForPlan({ plan: "enterprise", teamSeats: null, enterpriseSeatLimit: null })).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe("mapStatus", () => {
  test("should pass through trialing, active, and past_due", () => {
    expect(mapStatus("trialing")).toBe("trialing");
    expect(mapStatus("active")).toBe("active");
    expect(mapStatus("past_due")).toBe("past_due");
  });

  test("should collapse canceled, ended, and revoked to canceled", () => {
    expect(mapStatus("canceled")).toBe("canceled");
    expect(mapStatus("ended")).toBe("canceled");
    expect(mapStatus("revoked")).toBe("canceled");
  });

  test("should map an unknown status to incomplete", () => {
    expect(mapStatus("something_new")).toBe("incomplete");
  });
});

describe("parseTeamPricing", () => {
  // A seat-min-5 product, $10/seat (single fixed tier): 5 included = $50 base.
  const seatProduct = (interval: string | null) => ({
    recurringInterval: interval,
    prices: [
      {
        amountType: "seat_based",
        priceCurrency: "usd",
        seatTiers: {
          minimumSeats: 5,
          tiers: [{ minSeats: 5, maxSeats: null, pricePerSeat: 1000 }],
        },
      },
    ],
  });

  test("should derive base, included seats, and extra-seat price from seat tiers", () => {
    expect(parseTeamPricing(seatProduct("month"))).toEqual({
      interval: "month",
      includedSeats: 5,
      basePriceCents: 5000,
      extraSeatPriceCents: 1000,
      currency: "usd",
    });
  });

  test("should carry the annual interval through", () => {
    expect(parseTeamPricing(seatProduct("year"))?.interval).toBe("year");
  });

  test("should use the unbounded tier for the extra-seat price across graduated tiers", () => {
    const pricing = parseTeamPricing({
      recurringInterval: "month",
      prices: [
        {
          amountType: "seat_based",
          priceCurrency: "usd",
          seatTiers: {
            minimumSeats: 5,
            tiers: [
              { minSeats: 1, maxSeats: 5, pricePerSeat: 1000 },
              { minSeats: 6, maxSeats: null, pricePerSeat: 800 },
            ],
          },
        },
      ],
    });
    expect(pricing?.basePriceCents).toBe(5000); // 5 * first-tier 1000
    expect(pricing?.extraSeatPriceCents).toBe(800); // unbounded tier
  });

  test("should return null when the product is not recurring", () => {
    expect(parseTeamPricing(seatProduct(null))).toBeNull();
  });

  test("should return null when there is no seat-based price", () => {
    expect(
      parseTeamPricing({
        recurringInterval: "month",
        prices: [{ amountType: "fixed", priceCurrency: "usd" }],
      }),
    ).toBeNull();
  });
});
