import { useQuery } from "@tanstack/react-query";
import { orgSettingsQueryOptions } from "@/queries/org";
import { DEFAULT_CURRENCY } from "@/lib/public";

export function useOrgCurrency() {
  const { data } = useQuery(orgSettingsQueryOptions);
  return data?.settings.currency ?? DEFAULT_CURRENCY;
}
