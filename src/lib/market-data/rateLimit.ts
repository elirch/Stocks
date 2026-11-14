/**
 * Small in-memory fixed-window limiter. Per server instance only — adequate
 * as a guard for a low-traffic first release; replace with a shared store
 * if the app is scaled horizontally.
 */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function check(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (hits.size >= maxKeys) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        if (hits.size >= maxKeys) hits.clear();
      }
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    entry.count += 1;
    if (entry.count > limit) return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    return { allowed: true, retryAfterSec: 0 };
  };
}

/** Accepts tickers, ISINs and short names: letters, digits, spaces and . - & ' / */
export function validateQuery(raw: string | null): string | null {
  if (raw === null) return null;
  const q = raw.trim();
  if (q.length < 1 || q.length > 40) return null;
  if (!/^[\p{L}\p{N} .\-&'/]+$/u.test(q)) return null;
  return q;
}
