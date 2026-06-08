import type { H3Event } from 'h3'

/**
 * In-memory fixed-window rate limiter, keyed by an arbitrary string (usually
 * `scope:ip`). This is per-process state: on a multi-instance deployment each
 * instance keeps its own window, so the effective limit scales with the instance
 * count. Kalima runs as a single Railway instance, so this is sufficient; if it is
 * ever scaled horizontally, move these windows to a shared store (e.g. the DB or
 * Redis). It is a first line of defence, not the only one — the Anthropic budget is
 * additionally capped by the persistent daily counter in rateLimit.ts.
 */
interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()
const MAX_BUCKETS = 10_000

export interface ThrottleResult {
  allowed: boolean
  retryAfter: number // seconds until the window resets
}

export function throttle(key: string, limit: number, windowMs: number): ThrottleResult {
  const now = Date.now()

  // Bound memory: drop expired windows when the map grows large.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, w] of buckets) if (now >= w.resetAt) buckets.delete(k)
  }

  const w = buckets.get(key)
  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  w.count++
  if (w.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((w.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfter: 0 }
}

/** Derive a throttle key from the client IP (honours X-Forwarded-For behind Railway's proxy). */
export function clientKey(event: H3Event, scope: string): string {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  return `${scope}:${ip}`
}
