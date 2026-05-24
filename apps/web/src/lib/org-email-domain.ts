import type { EmailDomainDto } from "@workspace/contracts";
import { api } from "./api";

export type GetEmailDomainResponse = { domain: EmailDomainDto | null };
export type EmailDomainResponse = { domain: EmailDomainDto };

export function getOrgEmailDomain() {
  return api.get<GetEmailDomainResponse>("/api/org/email-domain");
}

export function createOrgEmailDomain(domain: string) {
  return api.post<EmailDomainResponse>("/api/org/email-domain", { domain });
}

export function verifyOrgEmailDomain() {
  return api.post<EmailDomainResponse>("/api/org/email-domain/verify", {});
}

export function deleteOrgEmailDomain() {
  return api.delete<{ deleted: boolean }>("/api/org/email-domain");
}
