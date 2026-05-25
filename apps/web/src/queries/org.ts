import { queryOptions } from "@tanstack/react-query";
import { getOrgMembers, getOrgSettings } from "@/lib/org";

export const orgKeys = {
  all: ["org"] as const,
  settings: () => [...orgKeys.all, "settings"] as const,
  members: () => [...orgKeys.all, "members"] as const,
};

export const orgSettingsQueryOptions = queryOptions({
  queryKey: orgKeys.settings(),
  queryFn: getOrgSettings,
});

export const orgMembersQueryOptions = queryOptions({
  queryKey: orgKeys.members(),
  queryFn: getOrgMembers,
});
