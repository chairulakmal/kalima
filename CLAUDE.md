# CLAUDE.md (Kalima)

Guidance for Claude Code here: the invariants every change must respect, then pointers to where everything else lives. This file restates as little as possible; if it disagrees with a doc below, one of the two is a bug. Fix that one.

Kalima is a full-stack JLPT mock exam app (Nuxt 4 + TypeScript + Prisma + PostgreSQL on Railway), a recruiter-facing Demo covering the five N3 vocabulary question types from a pre-seeded pool.

**Being merged into [Bayana](https://bayana.chairulakmal.com)** (decided 2026-07-25, port pending). The deployment stays live, but expect maintenance, fixes, and doc work here, not features. Do not start V1 to V4 work without asking. *(`TODO.md` § Status)*

## SPEC.md is authoritative

**All technical truth lives in [`SPEC.md`](SPEC.md).** Read it before starting work, and update it in the same change when behaviour changes.

## Where things live

| Question | Answer lives in |
| --- | --- |
| How does X work, and why? | `SPEC.md` |
| The five decisions that shape the codebase | `ARCHITECTURE.md` |
| Quickstart, commands, env vars, Railway deploy | `README.md` |
| How questions are generated (prompt rules, per-type rules) | `questions/README.md`, `questions/vocab.md` |
| Threat model, hardening history, auth mechanics | `SECURITY.md` |
| Visual design system | `BRAND.md` |
| Merge status, port order, test gaps, known issues | `TODO.md` |
| What moves to Bayana and what does not: artifact shapes, the word crosswalk, the do-not-port list | `SPEC.md` §14 |

`questions/` and `scripts/` are gitignored: they exist on this machine, not in the repo. Cite them only in local-facing text; anything a reader of the clone sees has to stand without them.

## Invariants

One line each; the reasoning lives at the named section.

- `isCorrect`, `correctAnswer`, `explanation`, and `whyWrong` never reach the client during a quiz. Only `GET /api/session/results` returns them, after submit. *(SPEC §10)*
- Assembly and choice shuffling are server-side; the client only ever sees `ClientQuestion`. *(SPEC §9)*
- localStorage is a cache, never a source of truth. Every access sits behind `if (import.meta.client)`, and the localStorage-backed Pinia stores are options stores, not setup stores. *(SPEC §7)*
- The only live Anthropic call is `POST /api/session/analysis`. Generation runs offline via the gitignored `scripts/generate-seed.ts`. *(SPEC §6)*
- The daily budget goes through the atomic `consumeBudget()` upsert, with per-IP throttles underneath. *(SPEC §8, `SECURITY.md`)*
- One `ExamQuestion` per `(wordId, type)`; the pool is pre-seeded, 496 rows. *(SPEC §4.2, §6.1)*
- The homepage (`/`) is intentionally public, for recruiters. *(SPEC §2)*
- Admin auth is a fail-closed HMAC session token, never the password in a cookie. Read `SECURITY.md` before touching auth, rate limiting, or `/api/admin/*`.
- The Anthropic API key is server-side only, never referenced in `app/`. *(SPEC §10)*

## Trip-wires

- Test coverage is one tier deep: Vitest over server-side assembly and the pure `app/utils/` helpers, nothing on components or routes. *(SPEC §11)*
- `test/` is invisible to `nuxi typecheck`, whose config only includes `test/nuxt/**`. `npm run typecheck:test` covers it via `tsconfig.test.json`; both run in CI.
- Typed `$fetch`/`useRequestFetch` inside `useAsyncData` needs an explicit response generic (`$fetch<ResultsResponse>(…)`). Without it, Nuxt 4's route-map inference blows TypeScript's depth limit (TS2321), see nuxt#18570.
- No `prisma/migrations` directory: `prisma migrate deploy` does not apply; schema ships via `db push` on boot. *(README § Deployment)*
- Builder is Railpack, not Nixpacks; Node engines are pinned (25.x excluded). *(README § Deployment)*
- Word JSON lives in `/words/`, read via `fs` at runtime. It is not a static asset and does not belong in `app/assets/`. Shape: SPEC §4.1.
- When adding a question type or touching generation prompts, read the relevant `questions/` doc first; its rules tables are built to paste into prompts.
- `prisma/seed-data/passages-n3.json` is committed but never loaded (`seed.ts` matches only `questions-n*.json`). It is V1 pre-work and first in the port list, not dead data. *(SPEC §6.1)*
