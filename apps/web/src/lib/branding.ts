// Brand identity is env-driven so the same codebase can run as different
// products (white-label / fork). All user-facing brand references read from
// here. Fallback strings are deliberately loud so a missing config is obvious.
export const BUSINESS_NAME =
  (import.meta.env.VITE_BUSINESS_NAME as string) || "INSERT BUSINESS NAME";
export const BUSINESS_SLUG =
  (import.meta.env.VITE_BUSINESS_SLUG as string) || "insert-business-name";
