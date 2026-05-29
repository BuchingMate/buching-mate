import { createMiddleware } from "hono/factory";
import { apiError } from "../api/errors";
import type { ApiEnv } from "../api/types";

// In-process token-bucket rate limiter, keyed by a caller-supplied identifier
// (typically the authenticated user id). State is held in a Map and resets on
// process restart; this is fine for the current single-instance Bun deployment.
// Swap implementation for Redis/KV when we go multi-instance — call sites won't
// change.

type Bucket = { tokens: number; refilledAt: number };

interface RateLimitOptions {
  /** Resolve the bucket key for the request. Return null to skip limiting. */
  key: (c: Parameters<Parameters<typeof createMiddleware<ApiEnv>>[0]>[0]) => string | null;
  /** Max burst size. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSec: number;
  /** Error code surfaced to the client on exhaustion. */
  errorCode: string;
  /** Human-readable error message. */
  errorMessage?: string;
}

// Prune buckets that haven't been touched in a while so the Map doesn't grow
// without bound when users churn. Idempotent and cheap.
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const PRUNE_IDLE_MS = 10 * 60 * 1000;

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = opts.refillPerSec / 1000;

  setInterval(() => {
    const cutoff = Date.now() - PRUNE_IDLE_MS;
    for (const [key, b] of buckets) {
      if (b.refilledAt < cutoff) buckets.delete(key);
    }
  }, PRUNE_INTERVAL_MS).unref?.();

  return createMiddleware<ApiEnv>(async (c, next) => {
    const key = opts.key(c);
    if (!key) {
      await next();
      return;
    }
    const now = Date.now();
    const existing = buckets.get(key);
    const bucket: Bucket = existing
      ? {
          tokens: Math.min(
            opts.capacity,
            existing.tokens + (now - existing.refilledAt) * refillPerMs,
          ),
          refilledAt: now,
        }
      : { tokens: opts.capacity, refilledAt: now };

    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      return apiError(
        c,
        429,
        opts.errorCode,
        opts.errorMessage ?? "Too many requests — please slow down",
      );
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    await next();
  });
}
