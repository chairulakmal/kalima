# CLAUDE.md (Kalima)

Guidance for Claude Code when working in this repository: the invariants every change must respect, then pointers to where everything else lives. This file deliberately restates as little as possible; if it ever disagrees with the docs below, one of the two is a bug: fix that one.

Kalima is a full-stack JLPT mock exam app (Nuxt 4 + TypeScript + Prisma + PostgreSQL on Railway), currently a recruiter-facing Demo covering the five N3 vocabulary question types from a pre-seeded pool.

## SPEC.md is authoritative

**All technical truth lives in [`SPEC.md`](SPEC.md)**: system overview, data model, API contracts, AI integration, client cache, rate limiting, question assembly, security model, alternatives considered, and the roadmap. Read it before starting work, and update it in the same change when behaviour changes.

## Where things live

| Question | Answer lives in |
| --- | --- |
| How does X work, and why? | `SPEC.md` |
| Quickstart, commands, env vars, Railway deploy | `README.md` |
| How questions are generated (prompt rules, output contract, per-type rules) | `questions/README.md`, `questions/vocab.md` |
| Threat model, hardening history, auth mechanics | `SECURITY.md` |
| Visual design system | `BRAND.md` |
| Open work | `TODO.md` |

## Invariants

One line each; the full rules and their reasoning live at the named section.

- `isCorrect`, `correctAnswer`, `explanation`, and `whyWrong` never reach the client during a quiz; they are only returned by `GET /api/session/results` after submit. *(SPEC §10)*
- Question assembly and choice shuffling happen server-side; the client only ever sees `ClientQuestion`. *(SPEC §9)*
- localStorage is a cache, never a source of truth; every access is gated behind `if (import.meta.client)`, and the localStorage-backed Pinia stores are options stores, not setup stores. *(SPEC §7)*
- The only live Anthropic call is `POST /api/session/analysis`; question generation runs offline only, via `scripts/generate-seed.ts`. *(SPEC §6)*
- The daily Anthropic budget is consumed via the atomic `consumeBudget()` upsert, with per-IP throttles underneath as defence in depth. *(SPEC §8, `SECURITY.md`)*
- One `ExamQuestion` per `(wordId, type)`; the pool is pre-seeded, 496 rows. *(SPEC §4.2, §6.1)*
- The demo homepage (`/`) is intentionally public, for recruiters; V1+ features go behind auth. *(SPEC §2)*
- Admin auth is a fail-closed HMAC session token, never the password in a cookie; read `SECURITY.md` before touching auth, rate limiting, or `/api/admin/*`.
- The Anthropic API key is server-side only, never referenced in `app/`. *(SPEC §10)*

## Trip-wires

- There is no test suite and no CI: run `npm run typecheck` and `npm run lint` by hand before considering a change done. *(README § Checks)*
- Typed `$fetch`/`useRequestFetch` calls inside `useAsyncData` must pass an explicit response generic (e.g. `$fetch<ResultsResponse>(…)`); without it, Nuxt 4's route-map inference blows TypeScript's depth limit (TS2321), see nuxt#18570.
- There is no `prisma/migrations` directory: `prisma migrate deploy` does not apply here; schema ships via `db push` on boot. *(README § Deployment)*
- Builder is Railpack, not Nixpacks; Node engines are pinned (25.x excluded). *(README § Deployment, § Running locally)*
- Word JSON lives in `/words/` and is read via `fs` at runtime; it is not a static asset and does not belong in `app/assets/`. The `Word` shape is `SPEC.md` §4.1.
- When adding a question type or touching generation prompts, read the relevant `questions/` doc first; its rules tables are designed to be pasted into prompts. *(questions/README.md)*
