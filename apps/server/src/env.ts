import { z } from "zod";

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_CLIENT_ID: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

const paymentSchema = z.object({
  PAYMENT_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        try {
          return Buffer.from(v, "base64").length === 32;
        } catch {
          return false;
        }
      },
      { message: "PAYMENT_ENCRYPTION_KEY must be 32 bytes (base64)" },
    ),
});

const zoomSchema = z.object({
  ZOOM_CLIENT_ID: z.string().min(1).optional(),
  ZOOM_CLIENT_SECRET: z.string().min(1).optional(),
  ZOOM_REDIRECT_URI: z.string().url().optional(),
  ZOOM_WEBHOOK_SECRET_TOKEN: z.string().min(1).optional(),
});

const schema = z.intersection(z.intersection(stripeSchema, paymentSchema), zoomSchema);

function blank(v: string | undefined) {
  return v && v.length > 0 ? v : undefined;
}

const parsed = schema.safeParse({
  STRIPE_SECRET_KEY: blank(Bun.env.STRIPE_SECRET_KEY),
  STRIPE_CLIENT_ID: blank(Bun.env.STRIPE_CLIENT_ID),
  STRIPE_WEBHOOK_SECRET: blank(Bun.env.STRIPE_WEBHOOK_SECRET),
  PAYMENT_ENCRYPTION_KEY: blank(Bun.env.PAYMENT_ENCRYPTION_KEY),
  ZOOM_CLIENT_ID: blank(Bun.env.ZOOM_CLIENT_ID),
  ZOOM_CLIENT_SECRET: blank(Bun.env.ZOOM_CLIENT_SECRET),
  ZOOM_REDIRECT_URI: blank(Bun.env.ZOOM_REDIRECT_URI),
  ZOOM_WEBHOOK_SECRET_TOKEN: blank(Bun.env.ZOOM_WEBHOOK_SECRET_TOKEN),
});

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("env validation failed:", parsed.error.format());
  throw new Error("invalid env config");
}

export const env = parsed.data;

export const stripeEnabled = Boolean(
  env.STRIPE_SECRET_KEY && env.STRIPE_CLIENT_ID && env.STRIPE_WEBHOOK_SECRET,
);

export const zoomEnabled = Boolean(
  env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET && env.ZOOM_REDIRECT_URI,
);

export function requireZoomEnv() {
  if (!zoomEnabled) {
    throw new Error(
      "Zoom env vars required (ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_REDIRECT_URI)",
    );
  }
  return {
    clientId: env.ZOOM_CLIENT_ID!,
    clientSecret: env.ZOOM_CLIENT_SECRET!,
    redirectUri: env.ZOOM_REDIRECT_URI!,
    webhookSecretToken: env.ZOOM_WEBHOOK_SECRET_TOKEN,
  };
}

// ---- URLs / origins (single source of truth) ----------------------------------
//
// Required (with sensible localhost defaults):
//   WEB_URL    — browser-facing web app origin
//   SERVER_URL — API server origin (used as BETTER_AUTH_URL)
//
// Optional overrides:
//   PUBLIC_SITE_URL  — separate marketing/public origin if different from WEB_URL
//   TRUSTED_ORIGINS  — comma-separated extras appended to derived list

const SERVER_PORT = Bun.env.SERVER_PORT ?? "3456";
const WEB_PORT = Bun.env.WEB_PORT ?? "5678";

export const SERVER_URL = Bun.env.SERVER_URL ?? `http://localhost:${SERVER_PORT}`;
export const WEB_URL = Bun.env.WEB_URL ?? `http://localhost:${WEB_PORT}`;
export const PUBLIC_SITE_URL = Bun.env.PUBLIC_SITE_URL ?? WEB_URL;
export const BETTER_AUTH_URL = SERVER_URL;

function parseUrl(u: string) {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

const DEV_WILDCARD_SUFFIXES = [".lvh.me", ".localhost"];

export const TRUSTED_ORIGINS = (() => {
  const set = new Set<string>([WEB_URL, PUBLIC_SITE_URL]);
  for (const origin of [WEB_URL, PUBLIC_SITE_URL]) {
    const parsed = parseUrl(origin);
    if (!parsed) continue;
    set.add(`${parsed.protocol}//*.${parsed.host}`);
    // dev convenience: wildcard subdomains across common local TLDs at the same port
    const port = parsed.port ? `:${parsed.port}` : "";
    for (const suffix of DEV_WILDCARD_SUFFIXES) {
      set.add(`${parsed.protocol}//*${suffix}${port}`);
    }
  }
  for (const extra of (Bun.env.TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    set.add(extra);
  }
  return Array.from(set);
})();

export const PUBLIC_HOST_SUFFIXES = (() => {
  const set = new Set<string>([...DEV_WILDCARD_SUFFIXES, "localhost"]);
  for (const origin of [WEB_URL, PUBLIC_SITE_URL]) {
    const parsed = parseUrl(origin);
    if (parsed) set.add(parsed.hostname);
  }
  // explicit override append
  for (const extra of (Bun.env.PUBLIC_HOST_ALLOWLIST ?? Bun.env.PLATFORM_HOST_SUFFIXES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    set.add(extra);
  }
  return Array.from(set);
})();

export function requireStripeEnv() {
  if (!stripeEnabled) {
    throw new Error(
      "Stripe env vars required (STRIPE_SECRET_KEY, STRIPE_CLIENT_ID, STRIPE_WEBHOOK_SECRET)",
    );
  }
  return {
    secretKey: env.STRIPE_SECRET_KEY!,
    clientId: env.STRIPE_CLIENT_ID!,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET!,
  };
}
