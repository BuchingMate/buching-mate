// Server-side brand identity. Env-driven so deploys can rebrand without code
// changes. All user-facing brand strings (emails, OG fallback, service IDs)
// read from here. Fallback strings are deliberately loud so a missing config
// is obvious.
export const BUSINESS_NAME = process.env.BUSINESS_NAME || "INSERT BUSINESS NAME";
export const BUSINESS_SLUG = process.env.BUSINESS_SLUG || "insert-business-name";
