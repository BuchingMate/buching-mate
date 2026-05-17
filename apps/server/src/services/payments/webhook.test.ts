import { beforeEach, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { NormalizedPaymentEvent } from "../../payments/adapter";
import { InvalidSignatureError } from "../../payments/adapter";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import { seedAttendee, seedEvent, seedRegistration } from "../../../test/helpers/data";

let nextEvent: NormalizedPaymentEvent | null = null;
let throwInvalid = false;

const fakeAdapter = {
  provider: "stripe" as const,
  async verifyAndParse() {
    if (throwInvalid) throw new InvalidSignatureError();
    return nextEvent;
  },
};

mock.module("../../payments/registry", () => ({
  isAdapterAvailable: (p: string) => p === "stripe",
  getAdapter: () => fakeAdapter,
  listAvailableProviders: () => ["stripe"],
}));

const { handleWebhook } = await import("./webhook");
const { db } = await import("../../db");
const { registrations } = await import("../../db/schema");

beforeEach(() => {
  nextEvent = null;
  throwInvalid = false;
});

describe("handleWebhook", () => {
  test("should return unknown_provider when the provider name is not supported", async () => {
    const result = await handleWebhook({
      provider: "not_a_provider",
      headers: {},
      rawBody: "{}",
    });
    expect(result.type).toBe("unknown_provider");
  });

  test("should return invalid_signature when the adapter rejects the signature", async () => {
    throwInvalid = true;
    const result = await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    expect(result.type).toBe("invalid_signature");
  });

  test("should return ignored when the adapter returns no event", async () => {
    nextEvent = null;
    const result = await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    expect(result.type).toBe("ignored");
  });

  test("should mark the registration as paid and confirmed for a completed payment", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000 });
    const attendee = await seedAttendee(orgId);
    const reg = await seedRegistration(orgId, event.id, attendee.id, {
      status: "pending",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(Date.now() + 60_000),
    });

    nextEvent = {
      type: "payment.completed",
      paymentReference: "pi_test_123",
      providerEventId: "evt_test_1",
      registrationId: reg.id,
    };

    const result = await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    expect(result.type).toBe("ok");

    const after = await db.select().from(registrations).where(eq(registrations.id, reg.id));
    expect(after[0]?.status).toBe("confirmed");
    expect(after[0]?.paymentStatus).toBe("paid");
  });

  test("should return duplicate when the same provider event id arrives twice", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000 });
    const attendee = await seedAttendee(orgId);
    const reg = await seedRegistration(orgId, event.id, attendee.id, {
      status: "pending",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(Date.now() + 60_000),
    });

    nextEvent = {
      type: "payment.completed",
      paymentReference: "pi_dup",
      providerEventId: "evt_dup_1",
      registrationId: reg.id,
    };

    const first = await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    expect(first.type).toBe("ok");

    const second = await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    expect(second.type).toBe("duplicate");
  });

  test("should only apply the payment once even when the webhook is replayed", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000 });
    const attendee = await seedAttendee(orgId);
    const reg = await seedRegistration(orgId, event.id, attendee.id, {
      status: "pending",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(Date.now() + 60_000),
    });

    nextEvent = {
      type: "payment.completed",
      paymentReference: "pi_replay",
      providerEventId: "evt_replay_1",
      registrationId: reg.id,
    };

    await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    const afterFirst = await db.select().from(registrations).where(eq(registrations.id, reg.id));
    const firstUpdatedAt = afterFirst[0]?.updatedAt;

    await new Promise((r) => setTimeout(r, 10));
    await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });

    const afterSecond = await db.select().from(registrations).where(eq(registrations.id, reg.id));
    expect(afterSecond[0]?.paymentStatus).toBe("paid");
    expect(afterSecond[0]?.updatedAt?.getTime()).toBe(firstUpdatedAt?.getTime());
  });

  test("should cancel the registration when the payment expires", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000 });
    const attendee = await seedAttendee(orgId);
    const reg = await seedRegistration(orgId, event.id, attendee.id, {
      status: "pending",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(Date.now() + 60_000),
    });

    nextEvent = {
      type: "payment.expired",
      paymentReference: "pi_exp",
      providerEventId: "evt_exp_1",
      registrationId: reg.id,
    };

    await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    const after = await db.select().from(registrations).where(eq(registrations.id, reg.id));
    expect(after[0]?.status).toBe("cancelled");
    expect(after[0]?.paymentStatus).toBe("expired");
  });

  test("should cancel the registration when the payment fails", async () => {
    const { orgId } = await signUpAndCreateOrg();
    const event = await seedEvent(orgId, { price: 5000 });
    const attendee = await seedAttendee(orgId);
    const reg = await seedRegistration(orgId, event.id, attendee.id, {
      status: "pending",
      paymentStatus: "pending",
      paymentExpiresAt: new Date(Date.now() + 60_000),
    });

    nextEvent = {
      type: "payment.failed",
      paymentReference: "pi_fail",
      providerEventId: "evt_fail_1",
      registrationId: reg.id,
      reason: "card_declined",
    };

    await handleWebhook({ provider: "stripe", headers: {}, rawBody: "{}" });
    const after = await db.select().from(registrations).where(eq(registrations.id, reg.id));
    expect(after[0]?.status).toBe("cancelled");
    expect(after[0]?.paymentStatus).toBe("failed");
  });
});
