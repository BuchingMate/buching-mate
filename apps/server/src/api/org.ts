import { Hono } from "hono";
import type { OrgRole, UpdateOrgSettingsRequest } from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { isRecord, readJson, stringOrNull } from "./validation";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import {
  deleteInvite,
  getCurrentOrgContext,
  getOrgSettings,
  listMembers,
  removeMember,
  updateMemberRole,
  updateOrgSettings,
} from "../services/org";

const orgRoles = ["owner", "admin", "manager", "viewer"] as const;

function isOrgRole(value: string): value is OrgRole {
  return orgRoles.includes(value as OrgRole);
}

function parseUpdateOrgSettings(input: unknown): UpdateOrgSettingsRequest | string {
  if (!isRecord(input)) return "Request body must be an object";

  if ("slug" in input || "name" in input) {
    return "Slug and name are immutable via settings";
  }

  const parsed: UpdateOrgSettingsRequest = {};

  if (input.contactEmail !== undefined) {
    const contactEmail = stringOrNull(input.contactEmail);
    if (contactEmail === undefined) return "Contact email must be a string or null";
    parsed.contactEmail = contactEmail;
  }

  if (input.currency !== undefined) {
    if (typeof input.currency !== "string" || input.currency.trim().length === 0)
      return "Currency is required";
    parsed.currency = input.currency.trim().toUpperCase();
  }

  if (input.categories !== undefined) {
    if (
      !Array.isArray(input.categories) ||
      input.categories.some((category) => typeof category !== "string")
    ) {
      return "Categories must be an array of strings";
    }
    parsed.categories = input.categories;
  }

  if (input.categoryConfigs !== undefined) {
    if (!isRecord(input.categoryConfigs)) return "Category configs must be an object";
    const configs: Record<string, { color?: string; icon?: string }> = {};
    for (const [key, value] of Object.entries(input.categoryConfigs)) {
      if (!isRecord(value)) return `categoryConfigs.${key} must be an object`;
      const entry: { color?: string; icon?: string } = {};
      if (value.color !== undefined) {
        if (typeof value.color !== "string") return `categoryConfigs.${key}.color must be a string`;
        entry.color = value.color;
      }
      if (value.icon !== undefined) {
        if (typeof value.icon !== "string") return `categoryConfigs.${key}.icon must be a string`;
        entry.icon = value.icon;
      }
      configs[key] = entry;
    }
    parsed.categoryConfigs = configs;
  }

  if (input.webhookUrl !== undefined) {
    const webhookUrl = stringOrNull(input.webhookUrl);
    if (webhookUrl === undefined) return "Webhook URL must be a string or null";
    parsed.webhookUrl = webhookUrl;
  }

  if (input.emailTemplates !== undefined) {
    if (!isRecord(input.emailTemplates)) return "Email templates must be an object";
    parsed.emailTemplates = input.emailTemplates;
  }

  if (Object.keys(parsed).length === 0) return "At least one field is required";
  return parsed;
}

function parseUpdateMember(input: unknown): { role: OrgRole } | string {
  if (!isRecord(input)) return "Request body must be an object";
  if (typeof input.role !== "string" || !isOrgRole(input.role)) return "Role is invalid";
  return { role: input.role };
}

export const orgRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .get("/", (c) => c.json(getCurrentOrgContext(c.var.org, c.var.memberRole)))
  .get("/settings", async (c) => c.json({ settings: await getOrgSettings(c.var.orgId) }))
  .patch("/settings", requireRole("admin"), async (c) => {
    const input = parseUpdateOrgSettings(await readJson(c));

    if (typeof input === "string") {
      return apiError(c, 400, "invalid_org_settings", input);
    }

    return c.json({ settings: await updateOrgSettings(c.var.orgId, input) });
  })
  .get("/members", async (c) => c.json({ members: await listMembers(c.var.orgId) }))
  .post("/invites", requireRole("admin"), (c) =>
    c.json({ orgId: c.var.orgId, created: false }, 501),
  )
  .patch("/members/:memberId", requireRole("admin"), async (c) => {
    const input = parseUpdateMember(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_member", input);
    const updated = await updateMemberRole(c.var.orgId, c.req.param("memberId"), input.role);
    if (!updated) return apiError(c, 404, "member_not_found", "Member not found");
    return c.json({ updated: true });
  })
  .delete("/members/:memberId", requireRole("admin"), async (c) => {
    const removed = await removeMember(c.var.orgId, c.req.param("memberId"));
    if (removed === "cannot_remove_owner")
      return apiError(c, 400, "cannot_remove_owner", "Cannot remove owner");
    if (!removed) return apiError(c, 404, "member_not_found", "Member not found");
    return c.json({ deleted: true });
  })
  .delete("/invites/:inviteId", requireRole("admin"), async (c) => {
    const deleted = await deleteInvite(c.var.orgId, c.req.param("inviteId"));
    if (!deleted) return apiError(c, 404, "invite_not_found", "Invite not found");
    return c.json({ deleted: true });
  });
