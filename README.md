# Kalima

[![CI](https://github.com/chairulakmal/kalima/actions/workflows/ci.yml/badge.svg)](https://github.com/chairulakmal/kalima/actions/workflows/ci.yml)

A full-stack JLPT mock exam app built with Nuxt 4, TypeScript, Prisma, and PostgreSQL: practice the five N3 vocabulary question types from a 496-question pre-generated pool, sit the full 35-question section under a 30-minute timer, or drill a persistent wrong-answer queue, then get a Claude-written performance analysis, all without an account. The engineering point it is built around: correct answers structurally never reach the client during a quiz, because questions are assembled and graded server-side and the browser only ever sees shuffled choices with opaque IDs. Below: the live demo, what it covers, the highlights, the stack, running locally, and deployment on Railway; [ARCHITECTURE.md](ARCHITECTURE.md) walks the design decisions.

**Live demo:** [kalima.chairulakmal.com](https://kalima.chairulakmal.com). The homepage and quiz are intentionally public, no sign-up required.

## What it covers

Five vocabulary question types from the JLPT N3 paper, matching the real exam format. Play each type individually (10 questions), take the full vocabulary section (35 questions in the real 8-6-11-5-5 distribution, 30-minute timer), or run a targeted review session against your wrong-answer queue:

| # | Japanese | English | Format |
|---|---|---|---|
| 問題１ | 漢字読み | Kanji Reading | Kanji shown, pick the kana reading |
| 問題２ | 表記 | Kanji Writing | Kana shown, pick the correct kanji |
| 問題３ | 文脈規定 | Contextual Fill-in | Sentence with a blank, pick the word that fits |
| 問題４ | 言い換え類義 | Synonym | Pick the word closest in meaning, substitutable in the example sentence |
| 問題５ | 用法 | Correct Usage | Pick the sentence that uses the target word correctly |

Wrong answers are automatically added to a review queue; the home screen surfaces a gold review card whenever it is non-empty, and words answered correctly during a review session are pruned from it. This is the Demo release, covering the vocabulary section; the roadmap through V4 (reading, grammar, listening, real exam mode) lives in [SPEC.md §13](SPEC.md#13-product-roadmap).

## Highlights

- Correct answers structurally cannot leak during a quiz. `toClientQuestion` in [server/utils/assembleQuestion.ts](server/utils/assembleQuestion.ts) strips `isCorrect`, `correctAnswer`, and `explanation` before anything leaves the server, choices travel under opaque UUIDs with the correct one recorded per row in [prisma/schema.prisma](prisma/schema.prisma), and answers are only resolved by [server/api/session/results.get.ts](server/api/session/results.get.ts) after the session is submitted. Cheating would require guessing among four indistinguishable IDs, regardless of network interception.
- The live app makes exactly one kind of Anthropic call, and it cannot overspend. Question generation ran offline into a committed 496-row seed pool ([prisma/seed-data/questions-n3.json](prisma/seed-data/questions-n3.json), loaded idempotently by [prisma/seed.ts](prisma/seed.ts)), so the only live call is the post-session analysis in [server/api/session/analysis.post.ts](server/api/session/analysis.post.ts). It reserves budget through `consumeBudget()` in [server/utils/rateLimit.ts](server/utils/rateLimit.ts), a single atomic Postgres upsert-increment that closes the check-then-increment race, with a per-IP throttle ([server/utils/throttle.ts](server/utils/throttle.ts)) underneath as defence in depth. Over budget, the endpoint returns `null` and the UI silently omits the panel.
- Prompts are rebuilt from ground truth to match the real exam. `promptAndContext` in [server/utils/assembleQuestion.ts](server/utils/assembleQuestion.ts) derives each 問題 format from the word list ([words/n3.json](words/n3.json), 2111 entries read via `fs` at runtime), including okurigana-aware kanji-root replacement so a 問題2 sentence shows the conjugated word in kana with the answer hidden, the way the actual paper prints it.
- The wrong-answer review queue is device-local by design. A Pinia options store ([app/stores/reviewQueue.ts](app/stores/reviewQueue.ts)) self-persists to localStorage, upserts every miss, prunes on later correct answers, and replays through the existing [server/api/session/prepare.post.ts](server/api/session/prepare.post.ts) endpoint, which whitelist-validates and dedupes every submitted `(wordId, type)` pair before querying.
- A mid-quiz refresh loses nothing. [app/composables/useSession.ts](app/composables/useSession.ts) mirrors the session to localStorage strictly as a cache with the database authoritative, and because the mirror only ever holds the answer-free `ClientQuestion` shape, there is nothing in browser storage worth cheating from.
- The per-type accuracy radar chart is about 100 lines of hand-rolled SVG, no chart library. In [app/components/results/TypeChart.vue](app/components/results/TypeChart.vue) the vertex count derives reactively from however many types were actually tested, and untested types are excluded before the component ever sees the data, so an absent type can never collapse to the centre and be misread as a zero score.
- Admin sessions ride an HMAC-derived token, never the password. [server/utils/adminAuth.ts](server/utils/adminAuth.ts) mints a deterministic fail-closed token compared in constant time, [server/middleware/admin-auth.ts](server/middleware/admin-auth.ts) guards every `/api/admin/*` route server-side, and question quality is governed by majority-vote S-F ranks where protected and unreviewed questions cannot be bulk-deleted ([server/utils/rank.ts](server/utils/rank.ts)). [SECURITY.md](SECURITY.md) records the threat model and the hardening review that produced this design.
- Quiz cards slide with directional transitions. [app/pages/quiz.vue](app/pages/quiz.vue) computes the `<Transition>` name from a direction ref set by the next/back wrappers, and a global `prefers-reduced-motion` rule in [app/assets/css/main.css](app/assets/css/main.css) collapses all animation for users who ask for it.

## Stack

| Layer | What the code pins |
|---|---|
| Framework | Nuxt 4.4.8 (Vue 3.5, Nitro), TypeScript 5.9, strict mode |
| State | Pinia 4.0 via @pinia/nuxt |
| Styling | Tailwind CSS 4.3 (Vite plugin) |
| Data | Prisma 6.19, PostgreSQL 18 (Docker locally, Railway managed in production) |
| AI | @anthropic-ai/sdk 0.36, `claude-sonnet-4-6` for the live session analysis; generation ran offline with the same model ([SPEC.md §6](SPEC.md#6-ai-integration)) |
| Checks | ESLint 10.5, vue-tsc 3.3 |

## Running locally

Prerequisites: Docker, Node `^22.13.0 || ^24.11.0 || >=26.0.0` (the intersection of Nuxt 4's and ESLint 10's requirements; 25.x is excluded, and dev and Railway both run 24).

```bash
# 1. Env vars (fill in DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_PASSWORD)
cp .env.example .env

# 2. PostgreSQL 18 on :5432 (the only container)
docker compose up -d

# 3. Dependencies and schema
npm install
npx prisma db push

# 4. Load the 496 pre-generated questions
npm run db:seed

# 5. Dev server on :3000 (re-runs `docker compose up -d` for you)
npm run dev
```

### Checks

[CI](.github/workflows/ci.yml) runs all of these on every push to `main` and every pull request, plus `npm run build`. The same commands run locally:

```bash
npm run lint                  # eslint . (npm run lint:fix to autofix)
npm run typecheck             # vue-tsc, via nuxi
npm run typecheck:test        # tsc over test/, which Nuxt's tsconfig does not cover
npm test                      # vitest run (npm run test:watch to iterate)
```

The unit tests cover server-side question assembly (that the client projection of a question carries nothing identifying the correct choice, and that each JLPT question type builds the stem its format requires) and the pure helpers in `app/utils/`.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | none | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | none | Server-side only; never exposed to the client |
| `ADMIN_PASSWORD` | Yes | none | Protects `/admin`; the cookie holds an HMAC-derived token, never the password itself |
| `DAILY_API_LIMIT` | No | `10` | Max Anthropic API calls per UTC day (shared counter) |

## Deployment

Kalima deploys to Railway as a Nuxt Node server plus a PostgreSQL service. [railway.json](railway.json) sets the builder to Railpack (not Nixpacks), pins one replica in `asia-southeast1`, and restarts on failure (max 10 retries). Set `RAILPACK_NODE_VERSION=24` on the service.

There is no `prisma/migrations` directory, so `prisma migrate deploy` does not apply to this project. `npm start` pushes the schema (`prisma db push --accept-data-loss`), re-seeds the question pool, and then starts the Node server; schema changes ship via `db push` on every boot. Why that is a deliberate choice, and its limits, is covered in [ARCHITECTURE.md](ARCHITECTURE.md).

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) walks through the decisions with file paths: correct answers that live only on the server during a quiz, offline AI generation with one atomically budgeted live call, localStorage as a resilience cache rather than a source of truth, stateless fail-closed admin auth with a rank vote guarding question quality, and a schema that ships by `db push` on boot instead of migrations. Each section states the choice, the reasoning, and the trade-off accepted. [SPEC.md](SPEC.md) is the full technical spec and the project's source of truth.
