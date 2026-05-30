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

// Reusable token-bucket store. Wrap with rateLimit() for Hono routes, or call
// .consume(key) directly from places where a middleware doesn't fit (e.g.,
// better-auth hooks).
export class TokenBucketStore {
  private buckets = new Map<string, Bucket>();
  private refillPerMs: number;

  constructor(
    private capacity: number,
    refillPerSec: number,
  ) {
    this.refillPerMs = refillPerSec / 1000;
    setInterval(() => {
      const cutoff = Date.now() - PRUNE_IDLE_MS;
      for (const [k, b] of this.buckets) {
        if (b.refilledAt < cutoff) this.buckets.delete(k);
      }
    }, PRUNE_INTERVAL_MS).unref?.();
  }

  // Try to consume one token. Returns true on success, false when exhausted.
  consume(key: string): boolean {
    const now = Date.now();
    const existing = this.buckets.get(key);
    const bucket: Bucket = existing
      ? {
          tokens: Math.min(
            this.capacity,
            existing.tokens + (now - existing.refilledAt) * this.refillPerMs,
          ),
          refilledAt: now,
        }
      : { tokens: this.capacity, refilledAt: now };

    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return true;
  }
}

export function rateLimit(opts: RateLimitOptions) {
  const store = new TokenBucketStore(opts.capacity, opts.refillPerSec);

  return createMiddleware<ApiEnv>(async (c, next) => {
    const key = opts.key(c);
    if (!key) {
      await next();
      return;
    }
    if (!store.consume(key)) {
      return apiError(
        c,
        429,
        opts.errorCode,
        opts.errorMessage ?? "Too many requests — please slow down",
      );
    }
    await next();
  });
}
