import { createAccessControl } from "better-auth/plugins/access";
import type { OrgRole } from "@workspace/contracts";

export const statement = {
  organization: ["create", "update", "delete", "invite", "remove", "transfer"],
  invitation: ["create", "cancel"],
  member: ["create", "update", "delete"],
  dashboard: ["read"],
  event: ["read", "create", "update", "delete", "duplicate"],
  resource: ["read", "create", "update", "delete"],
  attendee: ["read", "create", "update"],
  registration: ["read", "create", "update", "delete"],
  settings: ["manage"],
  payment: ["configure"],
  webhook: ["configure"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  organization: ["create", "update", "delete", "invite", "remove", "transfer"],
  invitation: ["create", "cancel"],
  member: ["create", "update", "delete"],
  dashboard: ["read"],
  event: ["read", "create", "update", "delete", "duplicate"],
  resource: ["read", "create", "update", "delete"],
  attendee: ["read", "create", "update"],
  registration: ["read", "create", "update", "delete"],
  settings: ["manage"],
  payment: ["configure"],
  webhook: ["configure"],
});

export const admin = ac.newRole({
  organization: ["update"],
  dashboard: ["read"],
  event: ["read", "create", "update", "delete", "duplicate"],
  resource: ["read", "create", "update", "delete"],
  attendee: ["read", "create", "update"],
  registration: ["read", "create", "update", "delete"],
  settings: ["manage"],
  payment: ["configure"],
  webhook: ["configure"],
});

export const manager = ac.newRole({
  dashboard: ["read"],
  event: ["read", "create", "update", "duplicate"],
  resource: ["read", "create", "update"],
  attendee: ["read", "create", "update"],
  registration: ["read", "create", "update"],
});

export const viewer = ac.newRole({
  dashboard: ["read"],
  event: ["read"],
  resource: ["read"],
  attendee: ["read"],
  registration: ["read"],
});

const roleRank: Record<OrgRole, number> = {
  viewer: 0,
  manager: 1,
  admin: 2,
  owner: 3,
};

export function hasRole(memberRole: string, requiredRole: OrgRole) {
  return (roleRank[memberRole as OrgRole] ?? -1) >= roleRank[requiredRole];
}
