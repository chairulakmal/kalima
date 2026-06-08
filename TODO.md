# TODO

## Upcoming

### V1 — Reading Section

**Schema + seeding:**
- [ ] Add `Passage` and `ReadingQuestion` models to `prisma/schema.prisma`
      — `Passage(id, level, subtype, title?, text, notes Json?)` with `ReadingQuestion[]`
      — `ReadingQuestion(id, passageId, stem, correctAnswer, distractors Json, explanation)` 
- [ ] Write `prisma/seed-reading.ts` — upsert from `passages-n3.json`

**Session flow:**
- [ ] Add `SessionMode = 'reading'` — a reading session serves a set of passages, not individual questions
- [ ] `POST /api/session/prepare` reading branch — sample passages by subtype (N3 exam ratio: 4 short + 2 medium + 1 long + 1 info = 8 passages, 16 questions)
- [ ] `POST /api/session/submit` — adapt to reading session (answers keyed by `ReadingQuestion.id`)
- [ ] `GET /api/session/results` — reading session results

**UI — passage-visible reading:**
- INVARIANT: All questions for a passage are answered while the passage is visible on screen. This
  is how the real JLPT exam works. The passage never disappears until all its questions are answered.
- [ ] `ReadingCard.vue` — passage text (scrollable) + current question + choices, all on one screen
      Desktop: passage left, questions right (split layout)
      Mobile (412px): passage above (collapsed/expanded toggle), question + choices below
- [ ] Within a passage: Q1 → Q2 → … → Qn navigation; passage stays visible
- [ ] Between passages: passage changes, Q counter resets; overall progress bar shows passages done
- [ ] `results.vue` — reading results: per-passage breakdown with passage text visible on review

### V3 — Grammar Section

- [ ] Grammar question types (particle choice, conjugation, sentence structure)
- [ ] Grammar item data model
- [ ] Grammar question assembly path

### V4 — Listening Section

- [ ] Audio content sourcing or AI script generation
- [ ] Audio delivery (CDN / streaming)
- [ ] In-page audio player UI
- [ ] Listening question types matching JLPT format

### V4.5 — User Accounts & Mistake Notebook *(consider after full exam excluding listening ships)*

- [ ] User authentication (email/OAuth)
- [ ] Per-user mistake log — record each incorrect answer with `wordId`, `QuestionType`, and timestamp
- [ ] Mistake notebook view — browse and filter personal weak words by type
- [ ] Optional: spaced-repetition scheduling (surface weak words more often in new sessions)

> Prerequisite: V1–V3 complete (vocab + reading + grammar available). The mistake log is most useful when all non-listening question types are seeded and a user can meaningfully track cross-section weaknesses. Listening (V4) can be added to the tracking system incrementally.

---

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

### Demo / MVP — Security hardening
- [x] Token-based auth guard for `/admin` (HMAC session cookie, constant-time compare, login throttle)
- [x] Security hardening — Claude API + admin dashboard (see `SECURITY.md`)

### V1 — Passage generation (offline)
- [x] `scripts/generate-passages.ts` — generates `prisma/seed-data/passages-n3.json` (short×20, medium×10, long×5, info×10)
- [x] `scripts/audit-passages.ts` — structural audit + AI vocab check + `--fix` auto-regeneration for flagged passages
- [x] Passages reviewed and repaired via `--fix` mode; `passages-n3.json` finalised
