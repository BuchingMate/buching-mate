import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../../../test/helpers/auth";
import {
  approveEvent,
  createEvent,
  EventReviewRequiredError,
  EventReviewerInvalidError,
  rejectEvent,
  submitForReview,
  updateEvent,
} from "./index";

const baseInput = {
  title: "Review me",
  date: "2026-06-01",
  time: "10:00",
  duration: 60,
  videoProvider: null,
} as const;

describe("event review workflow", () => {
  test("assigning a reviewer puts the event into pending review", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const event = await createEvent(orgId, userId, { ...baseInput, reviewerId: userId });
    expect(event.reviewerId).toBe(userId);
    expect(event.reviewStatus).toBe("pending");
  });

  test("publishing is blocked while review is pending", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const event = await createEvent(orgId, userId, { ...baseInput, reviewerId: userId });
    await expect(updateEvent(orgId, event.id, { visibility: "published" })).rejects.toBeInstanceOf(
      EventReviewRequiredError,
    );
  });

  test("creating as published is blocked while review is pending", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    await expect(
      createEvent(orgId, userId, {
        ...baseInput,
        reviewerId: userId,
        visibility: "published",
      }),
    ).rejects.toBeInstanceOf(EventReviewRequiredError);
  });

  test("reviewer must be an organization member", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    await expect(
      createEvent(orgId, userId, { ...baseInput, reviewerId: "not-a-member" }),
    ).rejects.toBeInstanceOf(EventReviewerInvalidError);

    const event = await createEvent(orgId, userId, baseInput);
    await expect(
      updateEvent(orgId, event.id, { reviewerId: "not-a-member" }),
    ).rejects.toBeInstanceOf(EventReviewerInvalidError);
    await expect(submitForReview(orgId, event.id, "not-a-member", userId)).rejects.toBeInstanceOf(
      EventReviewerInvalidError,
    );
  });

  test("approve unlocks publishing", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const event = await createEvent(orgId, userId, { ...baseInput, reviewerId: userId });
    const approved = await approveEvent(orgId, event.id, userId);
    expect(approved).not.toBe("forbidden");
    expect(approved).not.toBeNull();
    expect((approved as { reviewStatus: string }).reviewStatus).toBe("approved");
    const published = await updateEvent(orgId, event.id, { visibility: "published" });
    expect(published!.visibility).toBe("published");
  });

  test("reject records a note and keeps the event gated", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const event = await createEvent(orgId, userId, { ...baseInput, reviewerId: userId });
    const rejected = await rejectEvent(orgId, event.id, userId, "Needs a better title");
    expect((rejected as { reviewStatus: string }).reviewStatus).toBe("rejected");
    expect((rejected as { reviewNote: string | null }).reviewNote).toBe("Needs a better title");
    await expect(updateEvent(orgId, event.id, { visibility: "published" })).rejects.toBeInstanceOf(
      EventReviewRequiredError,
    );
  });

  test("a non-reviewer cannot approve", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const event = await createEvent(orgId, userId, { ...baseInput, reviewerId: userId });
    const result = await approveEvent(orgId, event.id, "someone-else");
    expect(result).toBe("forbidden");
  });

  test("an event with no assigned reviewer cannot be approved", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const event = await createEvent(orgId, userId, baseInput);
    expect(await approveEvent(orgId, event.id, userId)).toBe("forbidden");
    expect(await rejectEvent(orgId, event.id, userId, null)).toBe("forbidden");
  });

  test("events without a reviewer publish freely", async () => {
    const { orgId, userId } = await signUpAndCreateOrg();
    const event = await createEvent(orgId, userId, baseInput);
    expect(event.reviewStatus).toBe("none");
    const published = await updateEvent(orgId, event.id, { visibility: "published" });
    expect(published!.visibility).toBe("published");
  });
});
