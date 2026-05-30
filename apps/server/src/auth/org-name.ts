// Sanitization for tenant-controlled strings (organization names) that end up
// inside outbound email subjects/bodies. Without this, an attacker can set a
// workspace name to a complete phishing pitch + URL and pump invites through
// our verified sending domain. See Kaneo writeup, May 2026.

// Rejects explicit URLs only. The previous bare-domain heuristic
// (\b[a-z0-9-]+\.[a-z]{2,}\b) was a false-positive magnet for legitimate
// brands like Acme.io, Vue.js, Next.js Berlin. Phishing names embedding a
// bare domain still slip through here; the captcha, disposable-email
// blocklist, and verify-email gate are the other layers that catch them.
const URL_RE = /(https?:\/\/|www\.)/i;
// Zero-width + RTL-override + BOM characters used for homoglyph / spoof tricks.
const INVISIBLE_RE = /[​-‏‪-‮﻿]/g;
const MAX_LEN = 64;

export class OrgNameError extends Error {}

export function sanitizeOrgName(raw: string): string {
  const normalized = raw.normalize("NFKC").replace(INVISIBLE_RE, "").trim();
  if (normalized.length === 0) {
    throw new OrgNameError("Organization name cannot be empty");
  }
  if (normalized.length > MAX_LEN) {
    throw new OrgNameError(`Organization name must be ${MAX_LEN} characters or fewer`);
  }
  if (URL_RE.test(normalized)) {
    throw new OrgNameError("Organization name cannot contain URLs");
  }
  return normalized;
}
