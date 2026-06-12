import type { CustomDomainDto } from "@workspace/contracts";
import { api } from "./api";

export type GetCustomDomainResponse = { domain: CustomDomainDto | null };
export type CustomDomainResponse = { domain: CustomDomainDto };

export function getOrgCustomDomain() {
  return api.get<GetCustomDomainResponse>("/api/org/custom-domain");
}

export function createOrgCustomDomain(domain: string) {
  return api.post<CustomDomainResponse>("/api/org/custom-domain", { domain });
}

export function verifyOrgCustomDomain() {
  return api.post<CustomDomainResponse>("/api/org/custom-domain/verify", {});
}

export function deleteOrgCustomDomain() {
  return api.delete<{ deleted: boolean }>("/api/org/custom-domain");
}
