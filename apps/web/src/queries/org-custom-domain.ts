import { queryOptions } from "@tanstack/react-query";
import { getOrgCustomDomain } from "@/lib/org-custom-domain";

export const orgCustomDomainKeys = {
  all: ["org-custom-domain"] as const,
};

export const orgCustomDomainQueryOptions = queryOptions({
  queryKey: orgCustomDomainKeys.all,
  queryFn: () => getOrgCustomDomain(),
});
