const raw = import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? "";

export const allowedEmailDomains: string[] = raw
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function isEmailDomainAllowed(email: string): boolean {
  if (allowedEmailDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return allowedEmailDomains.includes(domain);
}

export function emailDomainHint(): string | null {
  if (allowedEmailDomains.length === 0) return null;
  return `Only ${allowedEmailDomains.join(", ")} email addresses are permitted.`;
}
