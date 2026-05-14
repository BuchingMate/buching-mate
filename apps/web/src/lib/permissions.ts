import type { OrgRole } from "@workspace/contracts";

export function canManageEvents(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canDeleteEvents(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canManageAttendees(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canManageResources(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canDeleteResources(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canManageSettings(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canInviteMembers(role: OrgRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canDeleteOrg(role: OrgRole | null | undefined) {
  return role === "owner";
}

export function canManagePayments(role: OrgRole | null | undefined) {
  return role === "owner";
}

export function canManageWebhooks(role: OrgRole | null | undefined) {
  return role === "owner";
}

export function canManageConnectedApps(role: OrgRole | null | undefined) {
  return role === "owner";
}

export function canManageBilling(role: OrgRole | null | undefined) {
  return role === "owner";
}
