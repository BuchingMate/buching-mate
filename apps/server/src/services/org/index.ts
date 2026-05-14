import type {
  MemberDto,
  OrgRole,
  OrgSettingsDto,
  UpdateOrgSettingsRequest,
} from "@workspace/contracts";
import { and, eq } from "drizzle-orm";
import type { AuthOrg } from "../../api/types";
import { db } from "../../db";
import { invitation, member, orgSettings, user } from "../../db/schema";
import { rewritePublicAssetUrl } from "../assets/public-url";

export interface CurrentOrgContext {
  org: AuthOrg;
  memberRole: OrgRole;
}

export function getCurrentOrgContext(org: AuthOrg, memberRole: OrgRole): CurrentOrgContext {
  return { org: { ...org, logo: rewritePublicAssetUrl(org.logo) }, memberRole };
}

function toOrgSettingsDto(settings: typeof orgSettings.$inferSelect): OrgSettingsDto {
  return {
    id: settings.id,
    orgId: settings.orgId,
    plan: settings.plan,
    contactEmail: settings.contactEmail,
    currency: settings.currency,
    categories: settings.categories,
    categoryConfigs: settings.categoryConfigs,
    webhookUrl: settings.webhookUrl,
    webhookSecret: settings.webhookSecret,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function getOrgSettings(orgId: string): Promise<OrgSettingsDto> {
  const rows = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId)).limit(1);

  if (rows[0]) return toOrgSettingsDto(rows[0]);

  const created = await db.insert(orgSettings).values({ orgId }).returning();
  return toOrgSettingsDto(created[0]);
}

export async function updateOrgSettings(
  orgId: string,
  input: UpdateOrgSettingsRequest,
): Promise<OrgSettingsDto> {
  await getOrgSettings(orgId);

  const rows = await db
    .update(orgSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(orgSettings.orgId, orgId))
    .returning();

  return toOrgSettingsDto(rows[0]);
}

export async function listMembers(orgId: string): Promise<MemberDto[]> {
  const rows = await db
    .select({
      id: member.id,
      orgId: member.organizationId,
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, orgId));

  return rows.map((row) => ({
    ...row,
    role: row.role as OrgRole,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  role: OrgRole,
): Promise<boolean> {
  const rows = await db
    .update(member)
    .set({ role })
    .where(and(eq(member.organizationId, orgId), eq(member.id, memberId)))
    .returning({ id: member.id });

  return rows.length > 0;
}

export async function removeMember(
  orgId: string,
  memberId: string,
): Promise<boolean | "cannot_remove_owner"> {
  const rows = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.id, memberId)))
    .limit(1);

  if (!rows[0]) return false;
  if (rows[0].role === "owner") return "cannot_remove_owner";

  const deleted = await db
    .delete(member)
    .where(and(eq(member.organizationId, orgId), eq(member.id, memberId)))
    .returning({ id: member.id });

  return deleted.length > 0;
}

export async function deleteInvite(orgId: string, inviteId: string): Promise<boolean> {
  const rows = await db
    .delete(invitation)
    .where(and(eq(invitation.organizationId, orgId), eq(invitation.id, inviteId)))
    .returning({ id: invitation.id });

  return rows.length > 0;
}
