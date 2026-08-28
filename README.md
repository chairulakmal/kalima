# Kalima

[![CI](https://github.com/chairulakmal/kalima/actions/workflows/ci.yml/badge.svg)](https://github.com/chairulakmal/kalima/actions/workflows/ci.yml)

A full-stack JLPT mock exam app (Nuxt 4, TypeScript, Prisma, PostgreSQL): practise the five N3 vocabulary question types from a 496-question pre-generated pool, sit the full 35-question section under a 30-minute timer, or drill a wrong-answer queue, then get a Claude-written performance analysis. No account needed. The engineering point it is built around: correct answers structurally never reach the client during a quiz, because assembly and grading happen server-side and the browser only ever sees shuffled choices with opaque IDs. Below: the demo and its pending merge into Bayana, what it covers, the highlights, the stack, running locally, and deployment.

**Live demo:** [kalima.chairulakmal.com](https://kalima.chairulakmal.com). Homepage and quiz are public, no sign-up.

> **Kalima is being merged into [Bayana](https://bayana.chairulakmal.com).** Bayana is the successor JLPT app and already has N5 to N1 as a first-class level, a grammar table, and FSRS scheduling, so Kalima's five vocabulary types move there rather than growing here. Decided 2026-07-25; the port is still to come. Until then this deployment stays live and public and the code below is what runs, but no new features land here. Reasoning and port order: [TODO.md](TODO.md#status-superseded-2026-07-25).

## What it covers

Five vocabulary question types from the JLPT N3 paper. Play each type on its own (10 questions), take the full section (35 questions in the real 8-6-11-5-5 distribution, 30-minute timer), or run a review session against your wrong-answer queue:

| # | Japanese | English | Format |
|---|---|---|---|
| 問題１ | 漢字読み | Kanji Reading | Kanji shown, pick the kana reading |
| 問題２ | 表記 | Kanji Writing | Kana shown, pick the correct kanji |
| 問題３ | 文脈規定 | Contextual Fill-in | Sentence with a blank, pick the word that fits |
| 問題４ | 言い換え類義 | Synonym | Pick the word closest in meaning, substitutable in the example sentence |
| 問題５ | 用法 | Correct Usage | Pick the sentence that uses the target word correctly |

Wrong answers land in a review queue: the home screen shows a gold review card while it is non-empty, and words answered correctly in a review session are pruned. This is the Demo release. The V1 to V4 roadmap (reading, grammar, listening, real exam mode) stays in [SPEC.md §15](SPEC.md#15-product-roadmap) as a porting reference, not a plan.

## Highlights

- **Correct answers cannot leak during a quiz.** `toClientQuestion` in [server/utils/assembleQuestion.ts](server/utils/assembleQuestion.ts) strips `isCorrect`, `correctAnswer`, and `explanation` before anything leaves the server; choices travel under opaque UUIDs, the winner is stored per row in [prisma/schema.prisma](prisma/schema.prisma), and answers are resolved only by [server/api/session/results.get.ts](server/api/session/results.get.ts) after submit. Cheating means guessing among four indistinguishable IDs, network interception or not.
- **One kind of Anthropic call, and it cannot overspend.** Generation ran offline into a committed 496-row pool ([prisma/seed-data/questions-n3.json](prisma/seed-data/questions-n3.json), upserted by [prisma/seed.ts](prisma/seed.ts)), leaving the post-session analysis in [server/api/session/analysis.post.ts](server/api/session/analysis.post.ts) as the only live call. It reserves budget through `consumeBudget()` in [server/utils/rateLimit.ts](server/utils/rateLimit.ts), one atomic Postgres upsert-increment that closes the check-then-increment race, with a per-IP throttle ([server/utils/throttle.ts](server/utils/throttle.ts)) underneath. Over budget it returns `null` and the UI drops the panel.
- **Prompts are rebuilt from ground truth.** `promptAndContext` in [server/utils/assembleQuestion.ts](server/utils/assembleQuestion.ts) derives each 問題 format from the word list ([words/n3.json](words/n3.json), 2111 entries read via `fs` at runtime), including okurigana-aware kanji-root replacement so a 問題2 sentence shows the conjugated word in kana with the answer hidden, the way the paper prints it.
- **The review queue is device-local by design.** A Pinia options store ([app/stores/reviewQueue.ts](app/stores/reviewQueue.ts)) self-persists to localStorage, upserts every miss, prunes on later correct answers, and replays through the existing [prepare](server/api/session/prepare.post.ts) endpoint, which whitelists and dedupes every `(wordId, type)` pair before querying.
- **A mid-quiz refresh loses nothing.** [app/composables/useSession.ts](app/composables/useSession.ts) mirrors the session to localStorage strictly as a cache, database authoritative. The mirror holds only the answer-free `ClientQuestion` shape, so there is nothing in browser storage worth cheating from.
- **The accuracy radar is ~100 lines of hand-rolled SVG, no chart library.** In [app/components/results/TypeChart.vue](app/components/results/TypeChart.vue) the vertex count derives from however many types were actually tested, and untested types are excluded before the component sees them, so an absent type can never collapse to the centre and read as a zero score.
- **Admin sessions ride an HMAC token, never the password.** [server/utils/adminAuth.ts](server/utils/adminAuth.ts) mints a deterministic fail-closed token compared in constant time, [server/middleware/admin-auth.ts](server/middleware/admin-auth.ts) guards every `/api/admin/*` route server-side, and majority-vote S-F ranks keep unreviewed and known-good questions out of bulk deletes ([server/utils/rank.ts](server/utils/rank.ts)). Threat model and hardening review: [SECURITY.md](SECURITY.md).
- **Quiz cards slide directionally.** [app/pages/quiz.vue](app/pages/quiz.vue) picks the `<Transition>` name from a direction ref set by the next/back wrappers; a global `prefers-reduced-motion` rule in [app/assets/css/main.css](app/assets/css/main.css) collapses every animation.

## Stack

| Layer | What the code pins |
|---|---|
| Framework | Nuxt 4.4.8 (Vue 3.5, Nitro), TypeScript 5.9, strict mode |
| State | Pinia 4.0 via @pinia/nuxt |
| Styling | Tailwind CSS 4.3 (Vite plugin) |
| Data | Prisma 6.19, PostgreSQL 18 (Docker locally, Railway managed in production) |
| AI | @anthropic-ai/sdk 0.36, `claude-sonnet-4-6` for the live analysis; generation ran offline on the same model ([SPEC.md §6](SPEC.md#6-ai-integration)) |
| Checks | ESLint 10.5, vue-tsc 3.3, Vitest 4.1 |

## Running locally

Prerequisites: a PostgreSQL 18 server (Docker is the easiest way to get one), Node `^22.13.0 || ^24.11.0 || >=26.0.0` (the intersection of Nuxt 4's and ESLint 10's requirements; 25.x is excluded, and dev and Railway both run 24).

```bash
# 1. Env vars (fill in DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_PASSWORD)
cp .env.example .env

# 2. PostgreSQL 18 on :5432. Any instance works; this is a throwaway one.
docker run -d --name kalima-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kalima postgres:18

# 3. Dependencies and schema
npm install
npx prisma db push

# 4. Load the 496 pre-generated questions
npm run db:seed

# 5. Dev server on :3000 (start the database first; this does not)
npm run dev
```

### Checks

[CI](.github/workflows/ci.yml) runs all of these plus `npm run build` on every push to `main` and every pull request:

```bash
npm run lint                  # eslint . (npm run lint:fix to autofix)
npm run typecheck             # vue-tsc, via nuxi
npm run typecheck:test        # tsc over test/, which Nuxt's tsconfig does not cover
npm test                      # vitest run (npm run test:watch to iterate)
```

Tests cover server-side assembly (that the client projection leaks nothing, and that each type builds the stem its format requires) and the pure `app/utils/` helpers. Known gaps: [TODO.md](TODO.md#test-coverage-gaps-and-plan).

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | none | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | none | Server-side only; never exposed to the client |
| `ADMIN_PASSWORD` | Yes | none | Protects `/admin`; the cookie holds an HMAC-derived token, never the password |
| `DAILY_API_LIMIT` | No | `10` | Max Anthropic calls per UTC day (shared counter) |

## Deployment

Railway, as a Nuxt Node server plus a PostgreSQL service. [railway.json](railway.json) sets the builder to Railpack (not Nixpacks), pins one replica in `asia-southeast1`, and restarts on failure (max 10 retries). Set `RAILPACK_NODE_VERSION=24` on the service.

There is no `prisma/migrations` directory, so `prisma migrate deploy` does not apply. `npm start` runs `prisma db push --accept-data-loss`, re-seeds the pool, then starts the server, so schema changes ship on every boot. Why that is deliberate, and where it breaks: [ARCHITECTURE.md](ARCHITECTURE.md).

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) walks the five decisions that carry the codebase, each as choice, reasoning, and trade-off accepted, with file paths throughout. [SPEC.md](SPEC.md) is the full technical spec and the source of truth.
