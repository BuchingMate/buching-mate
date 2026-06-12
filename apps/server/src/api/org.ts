import { Hono } from "hono";
import type { OrgRole, UpdateOrgSettingsRequest } from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { isRecord, readJson, stringOrNull } from "./validation";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import { getSeatUsage } from "../ee/billing/polar";
import {
  deleteInvite,
  getCurrentOrgContext,
  getOrgSettings,
  listMembers,
  removeMember,
  updateMemberRole,
  updateOrgSettings,
} from "../services/org";
import {
  createEmailDomain,
  getEmailDomain,
  removeEmailDomain,
  verifyEmailDomain,
} from "../services/email/domains";
import {
  createCustomDomain,
  getCustomDomain,
  removeCustomDomain,
  verifyCustomDomain,
} from "../services/domains";

// A custom sending domain must be a plain hostname like "mail.acme.com".
const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function parseDomain(input: unknown): string | null {
  if (!isRecord(input) || typeof input.domain !== "string") return null;
  const domain = input.domain.trim().toLowerCase();
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

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

  if (input.emailBranding !== undefined) {
    if (!isRecord(input.emailBranding)) return "Email branding must be an object";
    const accentColor = stringOrNull(input.emailBranding.accentColor);
    const logoUrl = stringOrNull(input.emailBranding.logoUrl);
    const footerText = stringOrNull(input.emailBranding.footerText);
    if (accentColor === undefined) return "Accent color must be a string or null";
    if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      return "Accent color must be a hex value like #e2552b";
    }
    if (logoUrl === undefined) return "Logo URL must be a string or null";
    if (footerText === undefined) return "Footer text must be a string or null";
    parsed.emailBranding = { accentColor, logoUrl, footerText };
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
  .get("/seats", async (c) => c.json(await getSeatUsage(c.var.orgId)))
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
  })
  .get("/email-domain", requireRole("admin"), async (c) =>
    c.json({ domain: await getEmailDomain(c.var.orgId) }),
  )
  .post("/email-domain", requireRole("admin"), async (c) => {
    if (c.var.org.plan === "free") {
      return apiError(c, 402, "team_plan_required", "Custom sending domain requires the Team plan");
    }
    const domain = parseDomain(await readJson(c));
    if (!domain)
      return apiError(c, 400, "invalid_domain", "Enter a valid domain like mail.acme.com");
    return c.json({ domain: await createEmailDomain(c.var.orgId, domain) });
  })
  .post("/email-domain/verify", requireRole("admin"), async (c) => {
    const domain = await verifyEmailDomain(c.var.orgId);
    if (!domain) return apiError(c, 404, "domain_not_found", "No custom sending domain set");
    return c.json({ domain });
  })
  .delete("/email-domain", requireRole("admin"), async (c) => {
    await removeEmailDomain(c.var.orgId);
    return c.json({ deleted: true });
  })
  .get("/custom-domain", requireRole("admin"), async (c) =>
    c.json({ domain: await getCustomDomain(c.var.orgId) }),
  )
  .post("/custom-domain", requireRole("admin"), async (c) => {
    if (c.var.org.plan === "free") {
      return apiError(c, 402, "team_plan_required", "Custom domain requires the Team plan");
    }
    const domain = parseDomain(await readJson(c));
    if (!domain)
      return apiError(c, 400, "invalid_domain", "Enter a valid domain like events.acme.com");
    try {
      return c.json({ domain: await createCustomDomain(c.var.orgId, domain) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "invalid_hostname")
        return apiError(c, 400, "invalid_domain", "That hostname can't be used");
      if (message === "hostname_taken")
        return apiError(c, 409, "hostname_taken", "That domain is already in use");
      if (message === "custom_domains_unavailable")
        return apiError(c, 503, "custom_domains_unavailable", "Custom domains are not available");
      throw err;
    }
  })
  .post("/custom-domain/verify", requireRole("admin"), async (c) => {
    const domain = await verifyCustomDomain(c.var.orgId);
    if (!domain) return apiError(c, 404, "domain_not_found", "No custom domain set");
    return c.json({ domain });
  })
  .delete("/custom-domain", requireRole("admin"), async (c) => {
    await removeCustomDomain(c.var.orgId);
    return c.json({ deleted: true });
  });
