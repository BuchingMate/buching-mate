import { Hono } from "hono";
import type { BroadcastAudience, CreateBroadcastRequest } from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { isRecord, readJson } from "./validation";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import {
  createBroadcast,
  getBroadcast,
  listBroadcasts,
  sendBroadcast,
} from "../services/broadcasts";

function parseAudience(input: unknown): BroadcastAudience | null {
  if (!isRecord(input)) return null;
  if (input.type === "all_attendees") return { type: "all_attendees" };
  if (input.type === "event_guests" && typeof input.eventId === "string" && input.eventId.trim()) {
    return { type: "event_guests", eventId: input.eventId };
  }
  return null;
}

function parseCreateBroadcast(input: unknown): CreateBroadcastRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  if (input.kind !== "newsletter" && input.kind !== "invitation") return "Kind is invalid";
  if (typeof input.subject !== "string" || !input.subject.trim()) return "Subject is required";
  if (typeof input.bodyHtml !== "string" || !input.bodyHtml.trim()) return "Body is required";
  const audience = parseAudience(input.audience);
  if (!audience) return "Audience is invalid";
  return {
    kind: input.kind,
    subject: input.subject.trim(),
    bodyHtml: input.bodyHtml,
    audience,
  };
}

export const broadcastRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .get("/", async (c) => c.json({ broadcasts: await listBroadcasts(c.var.orgId) }))
  .post("/", requireRole("manager"), async (c) => {
    const input = parseCreateBroadcast(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_broadcast", input);
    const result = await createBroadcast(c.var.orgId, input);
    if (result === "invalid_event") {
      return apiError(c, 400, "invalid_event", "Event not found for this organization");
    }
    return c.json({ broadcast: result }, 201);
  })
  .get("/:broadcastId", async (c) => {
    const broadcast = await getBroadcast(c.var.orgId, c.req.param("broadcastId"));
    if (!broadcast) return apiError(c, 404, "broadcast_not_found", "Broadcast not found");
    return c.json({ broadcast });
  })
  .post("/:broadcastId/send", requireRole("manager"), async (c) => {
    const result = await sendBroadcast(c.var.orgId, c.req.param("broadcastId"));
    switch (result.type) {
      case "not_found":
        return apiError(c, 404, "broadcast_not_found", "Broadcast not found");
      case "invalid_state":
        return apiError(c, 409, "broadcast_not_draft", "Only a draft broadcast can be sent");
      case "no_recipients":
        return apiError(c, 400, "no_recipients", "This audience has no recipients");
      case "cap_exceeded":
        return apiError(
          c,
          402,
          "broadcast_cap_exceeded",
          `Weekly send limit of ${result.limit} reached (used ${result.used}). Upgrade your Broadcasts add-on for more.`,
        );
      case "sent":
        return c.json({ broadcast: result.broadcast });
    }
  });
