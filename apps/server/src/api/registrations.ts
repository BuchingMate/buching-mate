import { Hono } from "hono";
import type {
  CreateRegistrationRequest,
  PaymentStatus,
  RegistrationStatus,
  UpdateRegistrationRequest,
} from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { isRecord, readJson } from "./validation";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import {
  createRegistration,
  deleteRegistration,
  listRegistrations,
  updateRegistration,
} from "../services/registrations";

const registrationStatuses = ["pending", "confirmed", "waitlisted", "cancelled"] as const;
const paymentStatuses = [
  "not_required",
  "pending",
  "paid",
  "refunded",
  "expired",
  "failed",
] as const;

function isRegistrationStatus(value: string): value is RegistrationStatus {
  return registrationStatuses.includes(value as RegistrationStatus);
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus);
}

function parseCreateRegistration(input: unknown): CreateRegistrationRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  if (typeof input.eventId !== "string" || input.eventId.length === 0)
    return "Event ID is required";
  if (typeof input.attendeeId !== "string" || input.attendeeId.length === 0)
    return "Attendee ID is required";

  const parsed: CreateRegistrationRequest = {
    eventId: input.eventId,
    attendeeId: input.attendeeId,
  };

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !isRegistrationStatus(input.status))
      return "Registration status is invalid";
    parsed.status = input.status;
  }

  if (input.paymentStatus !== undefined) {
    if (typeof input.paymentStatus !== "string" || !isPaymentStatus(input.paymentStatus))
      return "Payment status is invalid";
    parsed.paymentStatus = input.paymentStatus;
  }

  return parsed;
}

function parseUpdateRegistration(input: unknown): UpdateRegistrationRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  const parsed: UpdateRegistrationRequest = {};

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !isRegistrationStatus(input.status))
      return "Registration status is invalid";
    parsed.status = input.status;
  }

  if (input.paymentStatus !== undefined) {
    if (typeof input.paymentStatus !== "string" || !isPaymentStatus(input.paymentStatus))
      return "Payment status is invalid";
    parsed.paymentStatus = input.paymentStatus;
  }

  if (Object.keys(parsed).length === 0) return "At least one field is required";
  return parsed;
}

export const registrationRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .get("/", async (c) => c.json({ registrations: await listRegistrations(c.var.orgId) }))
  .post("/", requireRole("manager"), async (c) => {
    const input = parseCreateRegistration(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_registration", input);

    const outcome = await createRegistration(c.var.orgId, input);
    if (outcome === "event_not_found")
      return apiError(c, 404, "event_not_found", "Event not found");
    if (outcome === "attendee_not_found")
      return apiError(c, 404, "attendee_not_found", "Attendee not found");
    if (outcome === "duplicate_registration") {
      return apiError(
        c,
        409,
        "duplicate_registration",
        "Attendee is already actively registered for this event",
      );
    }

    return c.json({ registration: outcome.registration }, outcome.type === "created" ? 201 : 200);
  })
  .patch("/:registrationId", requireRole("manager"), async (c) => {
    const input = parseUpdateRegistration(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_registration", input);

    const registration = await updateRegistration(
      c.var.orgId,
      c.req.param("registrationId"),
      input,
    );
    if (!registration) return apiError(c, 404, "registration_not_found", "Registration not found");
    return c.json({ registration });
  })
  .delete("/:registrationId", requireRole("admin"), async (c) => {
    const deleted = await deleteRegistration(c.var.orgId, c.req.param("registrationId"));
    if (!deleted) return apiError(c, 404, "registration_not_found", "Registration not found");
    return c.json({ deleted: true });
  });
