import { queryOptions } from "@tanstack/react-query";
import { getOrgSettings } from "@/lib/org";

export const orgKeys = {
  all: ["org"] as const,
  settings: () => [...orgKeys.all, "settings"] as const,
};

export const orgSettingsQueryOptions = queryOptions({
  queryKey: orgKeys.settings(),
  queryFn: getOrgSettings,
});
