# TODO

## Demo milestone — pre-V1

All questions are pre-seeded (500 total); no on-demand question generation. AI is used on-demand only for post-session results analysis, and will remain so through V5.

- [x] Seed 500 questions offline (100 × reading, orthography, contextual, synonym, usage) → `prisma/seed-data/questions-n3.json`
- [x] `prisma/seed-data/` split by JLPT level — `seed.ts` reads all `questions-n*.json` files
- [x] `prisma/seed.ts` — upsert seed rows into `ExamQuestion` with `model='seed'`
- [x] `prepare.post.ts` — sample from seed pool, no on-demand AI generation
- [x] `app/error.vue` — styled 404/500 error page
- [x] `文脈規定` question type (contextual fill-in, 問題3)
- [x] Mixed vocab session — 8-6-11-5 distribution, 30 questions in exam order
- [x] 30-minute countdown timer (vocab sessions only, colour shifts at 5:00 and 2:00)
- [x] Per-question type label in quiz header
- [x] Token-based auth guard for `/admin`

---

## Next — V1: Vocab Section

- [x] `用法` question type (問題5 — choose the sentence that uses the word correctly)
- [x] Generate 100 `usage` seed questions
- [x] Token-based auth guard for `/admin` (HMAC session cookie, constant-time compare, login throttle)
- [x] Security hardening — Claude API + admin dashboard (see `SECURITY.md`)

---

## Upcoming

### V2 — Reading Section

- [ ] `Passage` data model (Prisma schema)
- [ ] AI passage generation/curation for N3
- [ ] Reading question types: main idea, detail extraction, inference
- [ ] New session type or mixed-session flow for reading
- [ ] UI: passage + question layout (scrollable passage, question below)

### V3 — Grammar Section

- [ ] Grammar question types (particle choice, conjugation, sentence structure)
- [ ] Grammar item data model
- [ ] Grammar question assembly path

### V4 — Listening Section

- [ ] Audio content sourcing or AI script generation
- [ ] Audio delivery (CDN / streaming)
- [ ] In-page audio player UI
- [ ] Listening question types matching JLPT format

### V5 — Real Exam Mode

- [ ] Section sequencing engine: vocab → reading → grammar → listening in one session
- [ ] Per-section timers matching actual JLPT time allocation
- [ ] Lock between sections — no early exit, no revisiting previous sections
- [ ] Single combined submission at the end of the full exam
- [ ] Combined results page: section scores + overall score + cross-section AI analysis
- [ ] Unlock N1–N5 after V5 ships with stable N3
- [ ] Re-enable on-demand AI *question generation* — deferred until all sections are fully seeded and real exam mode is complete (results analysis remains on-demand throughout)

---

## Done

### Demo / MVP — Project setup
- [x] Nuxt 4 project scaffolded
- [x] Prisma schema created
- [x] Docker dev environment (Postgres via `docker-compose.yml`)
- [x] `app/types/index.ts` defined

### Demo / MVP — Server
- [x] `server/lib/prisma.ts` singleton
- [x] `server/utils/rateLimit.ts`
- [x] `server/utils/shuffle.ts` + `server/utils/assembleQuestion.ts`
- [x] `server/utils/wordIndex.ts`
- [x] `server/api/session/prepare.post.ts` (seed-pool sampling, no on-demand AI)
- [x] `server/api/session/submit.post.ts`
- [x] `server/api/session/results.get.ts`
- [x] `server/api/session/analysis.post.ts` (AI, rate-limited by DAILY_API_LIMIT)
- [x] `server/api/admin/questions.get.ts` (paginated, rank filter)
- [x] `server/api/admin/questions/[id].get.ts`
- [x] `server/api/admin/questions/[id].delete.ts`
- [x] `server/api/admin/questions/[id]/review.post.ts`
- [x] `server/api/admin/questions/bulk-delete.post.ts`
- [x] `server/utils/rank.ts` (majority-vote rank, unranked protected)

### Demo / MVP — Client
- [x] `useQuiz` composable
- [x] `useSession` composable
- [x] Pinia session store (`app/stores/session.ts`)
- [x] `index.vue` (question-type picker)
- [x] `loading.vue`
- [x] `quiz.vue`
- [x] `results.vue` (score + whyWrong + AI analysis)
- [x] `error.vue` (styled 404/500)
- [x] `admin/index.vue` (paginated, rank filter, bulk delete)
- [x] `admin/[id].vue` (word card + distractors + explanation + review form)
- [x] `QuizCard`, `ChoiceButton`, `Explanation`, `ProgressBar`, `LoadingSpinner` components

### Demo / MVP — Deployment & polish
- [x] Railway PostgreSQL connected
- [x] Deployed on Railway
- [x] Results page: `whyWrong` + user's wrong choice for incorrect answers
- [x] Admin: review system (rank S–F, majority vote, bulk delete)
- [x] Unranked question deletion protection
- [x] All-kana word exclusion for reading/orthography types
- [x] Similar/near-identical distractor validation
- [x] README created
- [x] Product roadmap documented in SPEC.md

### Demo / MVP — Vocab section expansion
- [x] `文脈規定` question type (問題3 — contextual fill-in)
- [x] `用法` question type (問題5 — correct usage)
- [x] Mixed vocab session (`SessionMode = 'vocab'`) — 8-6-11-5-5 distribution, 35 questions in exam order
- [x] `SessionQuestion.type` column — tracks per-question type in mixed sessions
- [x] 30-minute countdown timer (vocab sessions only; amber at ≤5 min, red at ≤2 min)
- [x] Per-question type label in quiz header for vocab sessions
- [x] `results.get.ts` — per-question type lookup for mixed sessions
- [x] `generate-seed.ts` — contextual + usage generation prompts + validators
- [x] Seed data split by JLPT level (`questions-n3.json`); `seed.ts` reads all `questions-n*.json`
- [x] Index page redesign — vocab primary card with 問題1–5 sub-cards; Reading/Grammar coming-soon placeholders
- [x] BRAND.md overhaul + `main.css` aligned (AMOLED dark theme, spacing scale, tap targets)
