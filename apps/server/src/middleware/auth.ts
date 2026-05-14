import type { OrgRole } from "@workspace/contracts";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { auth } from "../auth";
import { attendeeAuth } from "../auth/attendee";
import { hasRole } from "../auth/permissions";
import { db } from "../db";
import { member, organization, orgSettings } from "../db/schema";
import { apiError } from "../api/errors";
import type { ApiEnv, AttendeeEnv, OrgPlan } from "../api/types";
import { enrichLogger } from "../observability/request-context";

export const requireAttendee = createMiddleware<AttendeeEnv>(async (c, next) => {
  const session = await attendeeAuth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return apiError(c, 401, "unauthorized", "Authentication required");
  }
  c.set("attendeeUser", session.user);
  c.set("attendeeSession", session.session);
  enrichLogger({ attendeeUserId: session.user.id });
  await next();
});

export const requireAuth = createMiddleware<ApiEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return apiError(c, 401, "unauthorized", "Authentication required");
  }

  c.set("user", session.user);
  c.set("session", session.session);
  enrichLogger({ userId: session.user.id });
  await next();
});

export const requireOrg = createMiddleware<ApiEnv>(async (c, next) => {
  const user = c.var.user;
  const requestedOrgId = c.req.header("X-Org-Id");

  const memberships = await db
    .select({
      orgId: member.organizationId,
      role: member.role,
      orgName: organization.name,
      orgSlug: organization.slug,
      orgLogo: organization.logo,
      plan: orgSettings.plan,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .leftJoin(orgSettings, eq(orgSettings.orgId, organization.id))
    .where(
      requestedOrgId
        ? and(eq(member.userId, user.id), eq(member.organizationId, requestedOrgId))
        : eq(member.userId, user.id),
    );

  const membership = memberships[0];

  if (!membership) {
    return apiError(c, 403, "organization_required", "Organization membership required");
  }

  c.set("orgId", membership.orgId);
  c.set("memberRole", membership.role as OrgRole);
  c.set("org", {
    id: membership.orgId,
    name: membership.orgName,
    slug: membership.orgSlug,
    logo: membership.orgLogo,
    plan: (membership.plan ?? "free") as OrgPlan,
  });
  enrichLogger({ orgId: membership.orgId, orgSlug: membership.orgSlug, orgRole: membership.role });

  await next();
});

export function requireRole(requiredRole: OrgRole) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    if (!hasRole(c.var.memberRole, requiredRole)) {
      return apiError(c, 403, "forbidden", "You do not have permission to perform this action");
    }

    await next();
  });
}

const PLAN_RANK: Record<OrgPlan, number> = { free: 0, team: 1, enterprise: 2 };

export function requirePlan(minPlan: OrgPlan) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    const current = c.var.org.plan;
    if (PLAN_RANK[current] < PLAN_RANK[minPlan]) {
      return apiError(c, 402, "plan_required", `Requires ${minPlan} plan or higher`);
    }
    await next();
  });
}
