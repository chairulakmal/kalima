# CLAUDE.md — Kalima

## Project Overview

Kalima (Arabic/Quranic: "word") is a full-stack JLPT mock exam app built with Nuxt 4 + TypeScript.
The long-term target is a complete JLPT exam experience — vocabulary, reading, grammar, and listening — with AI-generated questions, per-distractor explanations, and personalized session analysis.
Currently in Demo: five selectable **vocabulary** question types — 問題1 漢字読み (`reading`), 問題2 表記 (`orthography`), 問題3 文脈規定 (`contextual`), 問題4 言い換え類義 (`synonym`), 問題5 用法 (`usage`) — with AI distractors + comprehensive analysis, deployed on Railway. The user picks a type on the start screen (10 questions) or runs the full vocabulary section (35 questions, 8-6-11-5-5 distribution, 30-minute timer).
500 questions pre-seeded (100 per type × 5 types) via `scripts/generate-seed.ts`; seed data in `prisma/seed-data/questions-n3.json`. No on-demand AI generation during a session. Post-session analysis uses `claude-sonnet-4-6`.
**The homepage (`/`) is intentionally public** — no login required, designed for tech recruiters. The `/admin` area is protected by HMAC session token + brute-force throttle (see `SECURITY.md`). V1+ user-facing features will be behind authentication.
Daily API budget (`DAILY_API_LIMIT`, default `10`) is shared across all Anthropic calls (currently: analysis only). Limit controlled via DAILY_API_LIMIT env var.

---

## Tech Stack

- **Framework:** Nuxt 4 + TypeScript (strict mode)
- **State management:** Pinia
- **Styling:** Tailwind CSS v4
- **AI (generation):** Anthropic API (`claude-sonnet-4-6`) — offline only via `scripts/generate-seed.ts`
- **AI (analysis):** Anthropic API (`claude-sonnet-4-6`) — called server-side only, rate-limited
- **ORM:** Prisma
- **Database:** PostgreSQL 18 (Railway)
- **Client cache:** localStorage (mirrors DB, speeds up repeat questions)
- **Testing:** Vitest + Vue Test Utils
- **Deployment:** Railway (Nuxt Node server + PostgreSQL service)

---

## Project Structure

```
/
├── CLAUDE.md
├── nuxt.config.ts
├── words/                       # word lists (already present)
│   ├── n5.json
│   ├── n4.json
│   ├── n3.json                  # active in MVP
│   ├── n2.json
│   └── n1.json
├── prisma/
│   └── schema.prisma
├── scripts/
│   └── split-words.ts
├── app/
│   ├── assets/
│   │   └── css/
│   │       └── main.css         # Tailwind v4 entry point
│   ├── components/
│   │   ├── quiz/
│   │   │   ├── QuizCard.vue
│   │   │   ├── ChoiceButton.vue
│   │   │   ├── Explanation.vue
│   │   │   └── ProgressBar.vue
│   │   └── ui/
│   │       └── LoadingSpinner.vue
│   ├── composables/
│   │   ├── useQuiz.ts
│   │   └── useSession.ts        # localStorage session cache (client-side only)
│   ├── pages/
│   │   ├── index.vue            # question-type picker + start screen
│   │   ├── loading.vue          # waits for /api/session/prepare
│   │   ├── quiz.vue             # active test session
│   │   ├── results.vue          # score + explanations + whyWrong + "Try Again"
│   │   └── admin/
│   │       ├── index.vue        # audit page — paginated list of ExamQuestions
│   │       └── [id].vue         # detail page — word card + correct answer + distractors
│   ├── stores/
│   │   └── session.ts           # Pinia — active TestSession
│   └── utils/
│       └── shuffle.ts           # Fisher-Yates
└── server/
    ├── api/
    │   ├── session/
    │   │   ├── prepare.post.ts  # POST — sample words, generate (per type), return client-safe questions
    │   │   ├── submit.post.ts   # POST — batch submit all 10 answers; sets completedAt
    │   │   ├── results.get.ts   # GET — score + explanations + whyWrong after session
    │   │   └── analysis.post.ts # POST — AI performance analysis after session
    │   └── admin/
    │       ├── questions.get.ts        # GET — paginated audit list (25/page)
    │       └── questions/
    │           └── [id].get.ts         # GET — single question detail + word lookup
    ├── lib/
    │   └── prisma.ts            # Prisma client singleton
    └── utils/
        ├── assembleQuestion.ts  # Word + ExamQuestion + type → Question; toClientQuestion projection
        ├── shuffle.ts           # Fisher-Yates
        ├── rateLimit.ts         # daily cap (DAILY_API_LIMIT), generation only
        └── wordIndex.ts         # module-level cached map across all 5 word-list files
```

---

## Key Architecture Rules

- **Answers and explanations are server-side only.** `isCorrect`, `correctAnswer`, and `explanation` are never sent to the client during a quiz — only returned via `GET /api/session/results` after the session ends. `whyWrong` is also withheld during the quiz; it is looked up from `ExamQuestion.distractors` at results time and included in `QuestionResult` only for incorrect answers.
- **Question assembly happens server-side.** Choices are shuffled server-side before returning to the client. The client never sees `isCorrect`.
- **Sentence-aware generation.** The model is given the word's `exampleSentence` and must produce a synonym substitutable into that sentence (authentic JLPT 問題4). Output comes back via Anthropic **tool use** (schema-validated), then a per-word validator rejects circular/shared-kanji/duplicate results to a fallback. See `questions/README.md`.
- **localStorage is a cache only.** It stores `{ sessionId, questions: ClientQuestion[], level, startedAt }` under key `kalima_session_v1`. It is cleared on session complete, "Try Again", or new session start. Source of truth is the DB.
- **Daily Anthropic budget is atomic + shared.** `POST /api/session/analysis` calls `consumeBudget()` (`server/utils/rateLimit.ts`) — a single atomic Postgres upsert+increment against the shared `RateLimit` row that reserves a slot and reports whether it was within `DAILY_API_LIMIT` (closes the old check-then-increment race). On overrun: analysis returns `{ analysis: null }`; results page silently omits the panel. A **per-IP throttle** (`server/utils/throttle.ts`) sits underneath as defence in depth: analysis 10/hour, `prepare` 30/10 min, admin login 5/15 min.
- **One ExamQuestion per (word, type)** (`@@unique([wordId, type])` in Prisma). 300 rows pre-seeded; on-demand generation is disabled for the demo.
- **Demo homepage is always public.** The `/` quiz requires no login — intentional for tech recruiters. Future features (V1+) will be behind auth.
- **All localStorage access must be guarded** with `if (import.meta.client)`. Pinia store uses `skipHydrate()` for localStorage-backed state.
- **Anthropic API key is server-side only** — never exposed to the client.
- **Admin auth is token-based, not password-in-cookie.** The `admin_session` cookie holds an opaque HMAC token derived from `ADMIN_PASSWORD` (`server/utils/adminAuth.ts`), never the password itself. All secret comparisons use `safeEqual()` (constant-time). Rotating `ADMIN_PASSWORD` invalidates every cookie. Auth is fail-closed: unset `ADMIN_PASSWORD` denies all `/api/admin/*`.
- **Security posture is documented in `SECURITY.md`** — threat model, the 2026-06-07 hardening review (Claude API + admin dashboard), and open recommendations. Read it before touching auth, rate limiting, or the admin routes.

---

## Session Flow

```
index.vue → user picks a question type → navigates to /loading?level=N3&type=…

loading.vue
  → POST /api/session/prepare { level, type }
  → store sessionId + questions in Pinia + localStorage
  → navigate to /quiz

quiz.vue
  → 10 questions, one at a time
  → answers collected locally (no server call per question)
  → on "Submit Test": POST /api/session/submit { sessionId, answers[] } → { ok: true }
  → no correctness feedback during quiz
  → after submit → navigate to /results

results.vue
  → GET /api/session/results?sessionId=... → score, time, per-question breakdown + explanations
  → POST /api/session/analysis { sessionId } → stats + AI analysis paragraph (async)
  → "Try Again" → index.vue

/admin
  → GET /api/admin/questions → table of all ExamQuestions (with type)
```

---

## Question Generation Reference

`questions/README.md` is the authoritative guide for how Kalima generates JLPT questions. It covers:
- Universal AI generation rules (explanation language, distractor constraints)
- The live generator (`generateExamQuestions`) and its exact tool-use output contract + worked example
- Per-type rules for vocabulary, grammar, reading, and listening
- Implementation status table (what's live vs. planned vs. out of scope)
- The per-word validation the server applies before persisting

**Question types live today: `reading`, `orthography`, `contextual`, `synonym`, `usage`** (`QuestionType` in [app/types/index.ts](app/types/index.ts)). A session's type is stored on `Session.type` and carried through `Question.type`. Generation is dispatched by type in `generateQuestions` ([prepare.post.ts](server/api/session/prepare.post.ts)); each `ExamQuestion` row is keyed by (`wordId`, `type`). For `reading`/`orthography` the correct answer is ground truth from the word data; for `contextual` it is `word.expression` or `word.reading` (whichever appears in the example sentence); for `synonym` and `usage` the answer is AI-generated + validated. The old `translation` (English-meaning) mode has been removed.

When adding a new question type or modifying generation prompts, read the relevant section in `questions/` first. The `AI generation rules` table in each section is designed to be pasted directly into an AI prompt.

---

## Word List

Word JSON files are at `/words/` in the project root. Server routes read them directly via `fs` — they are not served as static assets and do not need to be in `app/assets/`.

```typescript
// In server routes:
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const words = JSON.parse(readFileSync(join(process.cwd(), 'words', 'n3.json'), 'utf-8'))
```

### Word shape
```json
{
  "id": "cmpxvey7n00008ef2dlafd7ht",
  "guid": "HI-.Ij?HS~",
  "expression": "ああ",
  "reading": "ああ",
  "meaning": "Ah!, Oh!",
  "level": "N5",
  "tags": [],
  "exampleSentence": {
    "japanese": "ああ、そうか！忘れていました。",
    "reading": "ああ、そうか！わすれていました。",
    "english": "Ah, I see! I had forgotten."
  }
}
```

---

## SSR Notes

- Nuxt 4 config: `future: { compatibilityVersion: 4 }` in `nuxt.config.ts`
- Word list JSON loaded via `useAsyncData` — safe to SSR
- All localStorage access guarded with `if (import.meta.client)`
- Pinia session store: use `skipHydrate()` for localStorage-backed state

---

## Local Development

PostgreSQL runs in Docker; Nuxt runs on the host.

```bash
cp .env.example .env       # fill in ANTHROPIC_API_KEY
docker compose up -d       # start Postgres on port 5432
npm install
npx prisma db push         # sync schema to DB
npm run dev                # http://localhost:3000
```

---

## Deployment — Railway

### Services
- **kalima** — Nuxt 4 Node server
- **kalima-db** — PostgreSQL

### Build & start
```bash
npx nuxi build
node .output/server/index.mjs
```

### Environment variables
```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
DAILY_API_LIMIT=20
```

### Railway setup
1. Create new project → add PostgreSQL service
2. Add Nuxt app service → connect GitHub repo
3. Build command: `npx nuxi build` | Start command: `node .output/server/index.mjs`
4. Add env vars above
5. Run migrations: `npx prisma migrate deploy`

---

## Product Roadmap

Full detail in SPEC.md §13. N3 only throughout V1–V4; N1–N5 unlock after V5.

| Version | Focus |
|---------|-------|
| **Demo** (current) | 5 vocab types · 500 seed questions · Sonnet analysis · public homepage · HMAC admin auth |
| **V1** | Reading section |
| **V2** | Grammar section |
| **V3** | Grammar section |
| **V4** | Listening section |
| **V5** | Real exam mode — all sections in sequence, timed, single submission |