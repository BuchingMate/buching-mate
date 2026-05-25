import type {
  MemberDto,
  OrgRole,
  OrgSettingsDto,
  UpdateOrgSettingsRequest,
} from "@workspace/contracts";
import { api } from "./api";

export interface CurrentOrgResponse {
  org: {
    id: string;
    name: string;
    slug: string | null;
    logo: string | null;
    plan: "free" | "team" | "enterprise";
  };
  memberRole: OrgRole;
}

export function getCurrentOrg() {
  return api.get<CurrentOrgResponse>("/api/org");
}

export function getOrgSettings() {
  return api.get<{ settings: OrgSettingsDto }>("/api/org/settings");
}

export function updateOrgSettings(input: UpdateOrgSettingsRequest) {
  return api.patch<{ settings: OrgSettingsDto }>("/api/org/settings", input);
}

export function getOrgMembers() {
  return api.get<{ members: MemberDto[] }>("/api/org/members");
}
