import disposableDomains from "disposable-email-domains";

// Community-maintained list of throwaway-email providers (yomail.info, dropmail.me,
// etc). Loaded once at boot; lookup is O(1). Used at signup to deny accounts that
// would otherwise let a stranger borrow our verified sending domain for phishing.
const blocked = new Set<string>(disposableDomains as readonly string[]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && blocked.has(domain);
}
