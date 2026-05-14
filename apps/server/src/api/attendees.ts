import { Hono } from "hono";
import type { CreateAttendeeRequest, UpdateAttendeeRequest } from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { isRecord, readJson, stringOrNull } from "./validation";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import { createAttendee, getAttendee, listAttendees, updateAttendee } from "../services/attendees";
import { listRegistrationsByAttendee } from "../services/registrations";

function parseCreateAttendee(input: unknown): CreateAttendeeRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  if (typeof input.name !== "string" || input.name.trim().length === 0)
    return "Attendee name is required";
  if (typeof input.email !== "string" || input.email.trim().length === 0)
    return "Attendee email is required";
  const phone = stringOrNull(input.phone);
  if (phone === undefined) return "Phone must be a string or null";
  return { name: input.name.trim(), email: input.email.trim().toLowerCase(), phone };
}

function parseUpdateAttendee(input: unknown): UpdateAttendeeRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  const parsed: UpdateAttendeeRequest = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim().length === 0)
      return "Attendee name is required";
    parsed.name = input.name.trim();
  }

  if (input.email !== undefined) {
    if (typeof input.email !== "string" || input.email.trim().length === 0)
      return "Attendee email is required";
    parsed.email = input.email.trim().toLowerCase();
  }

  if (input.phone !== undefined) {
    const phone = stringOrNull(input.phone);
    if (phone === undefined) return "Phone must be a string or null";
    parsed.phone = phone;
  }

  if (Object.keys(parsed).length === 0) return "At least one field is required";
  return parsed;
}

export const attendeeRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .get("/", async (c) =>
    c.json({ attendees: await listAttendees(c.var.orgId, c.req.query("search") ?? null) }),
  )
  .post("/", requireRole("manager"), async (c) => {
    const input = parseCreateAttendee(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_attendee", input);
    return c.json({ attendee: await createAttendee(c.var.orgId, input) }, 201);
  })
  .get("/:attendeeId", async (c) => {
    const attendee = await getAttendee(c.var.orgId, c.req.param("attendeeId"));
    if (!attendee) return apiError(c, 404, "attendee_not_found", "Attendee not found");
    return c.json({ attendee });
  })
  .patch("/:attendeeId", requireRole("manager"), async (c) => {
    const input = parseUpdateAttendee(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_attendee", input);
    const attendee = await updateAttendee(c.var.orgId, c.req.param("attendeeId"), input);
    if (!attendee) return apiError(c, 404, "attendee_not_found", "Attendee not found");
    return c.json({ attendee });
  })
  .get("/:attendeeId/registrations", async (c) => {
    const attendee = await getAttendee(c.var.orgId, c.req.param("attendeeId"));
    if (!attendee) return apiError(c, 404, "attendee_not_found", "Attendee not found");
    return c.json({
      registrations: await listRegistrationsByAttendee(c.var.orgId, c.req.param("attendeeId")),
    });
  });
