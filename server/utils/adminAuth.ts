import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The admin session cookie holds an opaque token *derived* from ADMIN_PASSWORD —
 * never the password itself. Consequences:
 *   - A leaked cookie cannot reveal the real secret (it's a one-way HMAC) and is
 *     only replayable against this app, not anywhere the password is reused.
 *   - Rotating ADMIN_PASSWORD instantly invalidates every outstanding cookie.
 * The token is deterministic, so verification stays stateless (no session store).
 */
export function adminSessionToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null
  return createHmac('sha256', pw).update('kalima-admin-session-v1').digest('hex')
}

/** Constant-time string compare. Length mismatch returns false without throwing. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
