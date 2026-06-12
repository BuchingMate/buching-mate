// Server-side brand identity. Env-driven so deploys can rebrand without code
// changes. All user-facing brand strings (emails, OG fallback, service IDs)
// read from here. Fallback strings are deliberately loud so a missing config
// is obvious.
export const BUSINESS_NAME = process.env.BUSINESS_NAME || "INSERT BUSINESS NAME";
export const BUSINESS_SLUG = process.env.BUSINESS_SLUG || "insert-business-name";

// Platform postal address shown in the footer of marketing email. The platform
// is the sender of record (mail goes "via" it), so this one address satisfies
// the CAN-SPAM/CASL physical-address requirement for every org's broadcasts —
// orgs don't supply their own. Newlines render as separate lines in the footer.
export const BUSINESS_ADDRESS =
  process.env.BUSINESS_ADDRESS || "39 Wellington St\nBuxton NSW\nSydney, Australia";
