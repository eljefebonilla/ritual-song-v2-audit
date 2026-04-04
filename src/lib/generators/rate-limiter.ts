/**
 * Simple in-memory rate limiter for PDF generation.
 * Limits to maxRequests per windowMs per key (parish ID).
 *
 * Note: In-memory state resets on cold start. For production,
 * consider moving to Redis or Supabase-backed rate limiting.
 */
const store = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(
  key: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// Cleanup expired entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000).unref?.();
