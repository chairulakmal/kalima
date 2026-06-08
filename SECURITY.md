# Security — Kalima

This document records the security posture of Kalima, the hardening review of
2026-06-07, and the recommendations that remain open. The review focused on the two
highest-value surfaces for a public demo: **Anthropic (Claude) API access** and
**admin dashboard access**.

---

## Threat model

Kalima's homepage and quiz are intentionally public (no login — see `CLAUDE.md`). The
realistic threats are therefore:

1. **Denial of wallet** — an anonymous actor driving Anthropic API spend.
2. **Resource exhaustion** — flooding session/DB writes.
3. **Admin compromise** — guessing or stealing the single admin credential.

There is no per-user account system in the demo; sessions are anonymous and the admin
area is protected by a single shared password (`ADMIN_PASSWORD`).

---

## Hardening review — 2026-06-07

### Anthropic / Claude API access

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| C1 | High | `POST /api/session/analysis` was anonymous and capped **only** by a global daily counter, so a single client could drain the whole budget (denial of wallet). | Added a **per-IP throttle** (10/hour) in addition to the global daily cap. Defence in depth. |
| C2 | Medium | The daily budget used a check-then-increment (`canGenerate()` → `incrementCount()`) pattern — a TOCTOU race let concurrent requests overshoot `DAILY_API_LIMIT`. | Replaced with `consumeBudget()`, a single **atomic** Postgres upsert+increment that reserves a slot and reports whether it was within limit. Race-free. |
| C3 | Medium | `POST /api/session/prepare` had no rate limit — unbounded `Session`/`SessionQuestion` writes. | Added a **per-IP throttle** (30 / 10 min). No Anthropic spend here, but it caps DB writes. |
| C4 | Low | An Anthropic SDK error propagated as an unhandled 500 to the client. | Wrapped the call in `try/catch`; logs server-side and degrades to `{ analysis: null }` (results page silently omits the panel). |

The API key remains **server-side only** (`ANTHROPIC_API_KEY`), never exposed to the
client. Generation is offline-only (`scripts/generate-seed.ts`); the live app calls
Anthropic solely for post-session analysis.

### Admin dashboard access

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| A1 | High | The `admin_session` cookie value **was the admin password itself**, so any cookie leak (logs, proxies, backups) exposed the real secret. | The cookie now holds an **opaque HMAC-derived token** (`adminSessionToken()`), never the password. A leaked cookie can't reveal the secret and is only replayable against this app; rotating `ADMIN_PASSWORD` invalidates all cookies. |
| A2 | Medium | Password and cookie were compared with `!==` (timing-unsafe, short-circuits). | All secret comparisons now use `safeEqual()` (`crypto.timingSafeEqual`). |
| A3 | Medium | No brute-force protection on `POST /api/admin/auth` — unlimited guesses. | Added a **per-IP throttle** (5 attempts / 15 min) on the login endpoint. |

Cookie attributes were already sound and remain: `httpOnly`, `sameSite: 'strict'`,
`secure` in production, `path: '/'`, 7-day `maxAge`. The admin auth model is
**fail-closed**: if `ADMIN_PASSWORD` is unset, both the login endpoint and the
`/api/admin/*` middleware deny all access.

---

## Where the controls live

- `server/utils/adminAuth.ts` — `adminSessionToken()` (HMAC token derivation) + `safeEqual()` (constant-time compare).
- `server/utils/throttle.ts` — in-memory fixed-window per-IP limiter + `clientKey()`.
- `server/utils/rateLimit.ts` — `consumeBudget()` (atomic daily Anthropic cap) + legacy read-only `canGenerate()`.
- `server/middleware/admin-auth.ts` — guards all `/api/admin/*` except the login endpoint.
- `server/api/admin/auth.post.ts` — login: brute-force throttle + constant-time check + token cookie.
- `app/middleware/admin.global.ts` — client-side route guard; redirects unauthenticated `/admin` visits to `/admin/login` (UX layer; the API is the real boundary).

---

## Open recommendations (not yet implemented)

These are acceptable risks for the current demo but should be addressed before V1+
features ship behind real authentication:

1. **Shared per-process throttle state.** `throttle.ts` is in-memory. On a single
   Railway instance this is fine; if Kalima is ever scaled horizontally, the limits
   multiply per instance. Move windows to a shared store (DB or Redis) when scaling.
   The persistent daily Anthropic counter (`RateLimit` table) is already shared and is
   the hard cap regardless.
2. **No real account system.** A single shared `ADMIN_PASSWORD` has no per-user
   attribution, rotation policy, or MFA. Introduce proper auth (sessions + user
   records, or an external IdP) when admin usage grows beyond the maintainer.
3. **Security headers / CSP.** No Content-Security-Policy, `X-Frame-Options`, or
   `Strict-Transport-Security` are set. Add via Nitro route rules / `nuxt-security`.
4. **Login attempt logging / alerting.** 429s on `/api/admin/auth` are not surfaced
   anywhere; consider logging repeated failures for visibility.
5. **Body size limits.** Request bodies are read without an explicit size guard. Nitro
   defaults apply; set explicit limits if abuse is observed.

---

## Operational notes

- **Set a strong `ADMIN_PASSWORD`.** It is the single factor protecting `/admin`.
- **Rotating `ADMIN_PASSWORD` logs out all admin sessions** (the derived token changes).
- **`DAILY_API_LIMIT`** is the hard ceiling on daily Anthropic spend; the per-IP
  throttles sit underneath it as defence in depth.
