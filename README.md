# Kalima

**A full-stack JLPT mock exam app.** Practice any of the five N3 vocabulary question types individually, take the full 35-question vocabulary section under a 30-minute timer, or drill your weak words via a persistent wrong-answer review queue — then get a personalised Sonnet-powered performance analysis, all without an account.

> **Live demo → [kalima.chairulakmal.com](https://kalima.chairulakmal.com)**

---

## What it covers

Five vocabulary question types from the JLPT N3 paper, matching the real exam format. Play each type individually (10 questions), take the full vocab section (35 questions, 8-6-11-5-5 distribution, 30-minute timer), or run a targeted review session against your wrong-answer queue:

| # | Japanese | English | Format |
|---|---|---|---|
| 問題１ | 漢字読み | Kanji Reading | Kanji shown → pick the kana reading |
| 問題２ | 表記 | Kanji Writing | Kana shown → pick the correct kanji |
| 問題３ | 文脈規定 | Contextual Fill-in | Sentence with a blank → pick the word that fits |
| 問題４ | 言い換え類義 | Synonym | Pick the word closest in meaning, substitutable in the example sentence |
| 問題５ | 用法 | Correct Usage | Pick the sentence that uses the target word correctly |

After any session, wrong answers are automatically added to a **review queue** (localStorage-backed Pinia store). The home screen surfaces a gold review card whenever the queue is non-empty; starting it sends the specific `(wordId, type)` pairs to the server for targeted practice. Words answered correctly during a review session are pruned from the queue.

---

## Design decisions worth noting

### Answers never leave the server during a quiz

`correctAnswer`, `isCorrect`, and `explanation` are withheld from every API response during an active session. The client receives only shuffled choices with opaque IDs. Correct answers are resolved server-side by `GET /api/session/results` after the session is submitted — structurally preventing client-side cheating regardless of network interception.

### AI distractors are generated via tool use, then validated

For each word, the model receives the word, its meaning, and its example sentence, and returns distractors through a schema-constrained tool call. A per-word validator then rejects:
- Circular distractors (the word itself or its reading)
- Shared-kanji distractors (visually too close to the correct answer)
- Duplicate distractors within the set

For 問題４, the synonym must be substitutable into the example sentence — the generation prompt enforces this explicitly, matching authentic JLPT intent.

### Generation and analysis are separate — but share one counter

Questions are pre-generated offline via `scripts/generate-seed.ts` (500 rows, one per word–type pair). The live app never generates questions on demand. A single `DAILY_API_LIMIT` counter in the DB guards the one live AI call — the post-session analysis. On limit: analysis returns `null` and the UI silently omits the panel.

### localStorage is a resilience layer, not a source of truth

Session state (`sessionId`, shuffled questions, `startedAt`) is mirrored to localStorage so a mid-quiz refresh doesn't lose progress. It is cleared on session completion or on starting a new session. The database is always authoritative.

### Wrong-answer queue is device-local by design

Every wrong answer is upserted into a `ReviewItem[]` array in a Pinia options store that self-manages its own localStorage persistence (`kalima_review_v1`). The store is never hydrated during SSR — `load()` is called only from `onMounted` via `useReviewQueue().init()`, keeping all localStorage access behind `import.meta.client`. No server changes were required; the review session reuses the existing `POST /api/session/prepare` endpoint with a `reviewItems` payload, and the server validates every `type` field against a whitelist before querying.

### Quiz cards slide with directional transitions

Advancing to the next question slides the old card left and brings the new one in from the right; navigating back reverses the direction. This is implemented with a computed `<Transition>` name (`quiz-forward` / `quiz-backward`) and `mode="out-in"`, using a `direction` ref that the `goNext()` / `goBack()` wrappers set before updating `currentIndex`. The scoped keyframes respect `prefers-reduced-motion` via a global `animation-duration: 0.01ms` rule in `main.css`.

### Per-type accuracy is a hand-rolled SVG radar chart

The results page renders a pentagon (or triangle/quadrilateral for fewer types) SVG radar chart with no chart library. Vertex count derives from `computed(() => props.entries.length)` so the geometry recalculates reactively. Grid rings, axis lines, the filled data polygon, and vertex dots are all paths/circles driven by polar-coordinate helpers. Only types actually tested in the session are passed as entries — untested types are excluded before the component ever sees the data, so an absent type can never visually collapse to the centre and be misread as a zero score.

### Admin review system prevents question quality drift

`/admin` lists all 500 seed questions. Each can be rated S–F by any reviewer; the effective rank is a majority vote across all reviews. Questions with no reviews are protected from bulk delete — the system won't silently discard unreviewed content. The admin area is protected by an HMAC-derived session token with constant-time comparison and a brute-force throttle on login (see `SECURITY.md`).

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 4 · TypeScript strict mode |
| State | Pinia |
| Styling | Tailwind CSS v4 |
| AI (question generation) | `claude-sonnet-4-6` — offline only, via `scripts/generate-seed.ts` |
| AI (session analysis) | `claude-sonnet-4-6` — server-side, rate-limited |
| ORM | Prisma |
| Database | PostgreSQL |
| Deployment | Railway (Nuxt Node server + PostgreSQL service) |

---

## Session flow

```
/               Pick mode: full vocab section, individual question type, or review queue
/loading        Fresh session: POST /api/session/prepare { level, type }
                Review session: POST /api/session/prepare { level, type: 'review', reviewItems }
/quiz           Answers collected client-side; directional slide transitions between cards
                30-min countdown timer for vocab sessions only
                Submit → POST /api/session/submit (all answers at once)
/results        GET  /api/session/results  — score · time · per-question breakdown · whyWrong
                Per-type accuracy radar chart (vocab / review sessions)
                Wrong answers upserted to review queue; correct review answers pruned
                POST /api/session/analysis — Sonnet paragraph (async, shown when ready)
/admin/login    Password-protected entry point
/admin          Paginated audit list of all generated questions
/admin/:id      Full word card · distractor choices · explanation · S–F review form
```

---

## Project structure

```
app/
  pages/          index · loading · quiz · results · admin/
  components/
    quiz/         QuizCard · ChoiceButton · Explanation · ProgressBar
    results/      TypeChart.vue — hand-rolled SVG radar chart
    ui/           LoadingSpinner
  composables/    useQuiz · useSession · useReviewQueue
  middleware/     admin.global.ts — client-side admin auth guard
  stores/         session · reviewQueue (both Pinia options stores)
  types/          index.ts — shared TypeScript types (incl. ReviewItem)

server/
  api/session/    prepare · submit · results · analysis
  api/admin/      questions list · detail · review · bulk-delete · auth · logout
  middleware/     admin-auth.ts — guards all /api/admin/* routes server-side
  utils/          rateLimit · throttle · adminAuth · wordIndex · shuffle · assembleQuestion · rank

prisma/
  schema.prisma   Session · SessionQuestion · ExamQuestion · ExamQuestionReview · RateLimit

words/
  n1–n5.json     Word lists (read by the server at runtime via fs, not bundled)

scripts/
  generate-seed.ts      Offline question generation (Sonnet tool use, validator, upsert)
  generate-passages.ts  Offline reading passage generation (for V1)
```

---

## Local development

**Prerequisites:** Node.js 20+, Docker

```bash
cp .env.example .env          # fill in DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_PASSWORD
docker compose up -d          # start Postgres on :5432
npm install
npx prisma db push
npm run db:seed               # load the 500 pre-generated questions
npm run dev                   # http://localhost:3000
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | — | Server-side only; never exposed to the client |
| `ADMIN_PASSWORD` | Yes | — | Protects `/admin`; cookie holds an HMAC-derived token, never the password itself |
| `DAILY_API_LIMIT` | No | `10` | Max Anthropic API calls per UTC day (shared counter) |

---

## Deployment (Railway)

```bash
npx nuxi build
npm run start     # runs prisma db push, seeds questions, then starts the Node server
```

`railway.json` sets the builder to **Railpack** and the health-check to `/`.

---

## Roadmap

| Version | Focus |
|---|---|
| **Demo** (now) | 5 vocab types · 35 q mixed session (8-6-11-5-5) · 30-min timer · wrong-answer review queue · per-type SVG radar chart · directional quiz transitions · Sonnet analysis · HMAC-protected admin |
| **V1** | Reading section · AI passage generation (passages pre-generated; session UI in progress) |
| **V2** | Grammar section |
| **V3** | Listening section |
| **V4** | Full exam mode — all sections, timed, single submission · N1–N5 unlock |
