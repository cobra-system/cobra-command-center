/**
 * Simple in-memory fixed-window rate limiter for Edge Functions.
 * Tracks requests by key (e.g., IP address) within a time window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * Check if a request should be rate-limited.
 * @param key - Unique identifier (e.g., IP or email)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with `limited` boolean and `retryAfterMs` if limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): { limited: boolean; retryAfterMs?: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }

  return { limited: false };
}

/**
 * Extract client identifier from request for rate limiting.
 * Uses X-Forwarded-For, X-Real-IP, or falls back to a default.
 */
export function getClientId(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
