import { queryOptions } from "@tanstack/react-query";
import { getOrgEmailDomain } from "@/lib/org-email-domain";

export const orgEmailDomainKeys = {
  all: ["org-email-domain"] as const,
};

export const orgEmailDomainQueryOptions = queryOptions({
  queryKey: orgEmailDomainKeys.all,
  queryFn: () => getOrgEmailDomain(),
});
