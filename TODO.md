# TODO

Kalima's work queue and its record of finished work. The headline: Kalima is being merged into [Bayana](https://bayana.chairulakmal.com), so no new feature work lands here and everything below is a porting reference rather than a plan. In order: the merge and the port order it implies, the test-coverage gaps worth closing first, known issues, the V1 to V4 roadmap kept for reference, and the log of what shipped.

## Contents

- [Status: superseded](#status-superseded-2026-07-25)
- [Port order](#port-order)
- [Test coverage: gaps and plan](#test-coverage-gaps-and-plan)
- [Known issues](#known-issues)
- [Upcoming](#upcoming)
- [Done](#done)

## Status: superseded (2026-07-25)

Kalima's features migrate into [Bayana](https://bayana.chairulakmal.com), the successor JLPT app. The port is still to come; until it lands this repo stays live and public, but new work does not come here. Everything under "Upcoming" is a porting reference, not a work queue.

Two reasons. Kalima is the thinnest repo in the portfolio while holding a primary slot on the homepage, and its five N3 vocabulary types are a subset of what Bayana's data model already holds: N5 to N1 as a first-class level, a grammar table, and the FSRS scheduling that V1 to V4 would each have needed. Bayana also takes over as the reference consumer of the bayan/zaka dataset.

The Vitest suite and CI landed after that decision, as maintenance rather than features: they pin the invariants that have to survive the port, so a regression is caught here before it is copied there.

Do not delete or unhost this repo. Nuxt PR #35697's provenance points at it, and both the homepage and the CV link it. Archive it with a pointer to Bayana once the port lands.

## Port order

- [ ] Shape the question store in Bayana like bayan's `ExportedQuestion`, not like this repo's `ExamQuestion`, so bayan releases and these 496 seeded rows share one table instead of needing a migration later. The five types map onto bayan's enum: `reading` to `read-kanji`, `orthography` to `pick-spelling`, `contextual` to `word-choice`, `synonym` to `same-meaning`, `usage` to `right-sentence`. Keep bayan's `source` field, and leave room for `stimuli` and `provenance` so reading and listening need no schema change.
- [ ] Port the answer-secrecy design: `toClientQuestion` stripping, opaque choice IDs, answers resolved only by the results endpoint after submit.
- [ ] Port `consumeBudget()` (atomic upsert) and the per-IP throttle. Bayana has only an in-memory limiter today.
- [ ] Port the wrong-answer review queue, rehomed from localStorage onto Bayana's per-user rows.
- [ ] Port the timed 35-question vocab session and `TypeChart.vue`. Bayana's successor app is greenfield Nuxt, so the radar moves as a Vue SFC rather than being rewritten; the same now goes for every component in this list. Per-module verdicts: [SPEC §14.2](SPEC.md#142-verdict-per-module).
- [ ] Carry `prisma/seed-data/passages-n3.json` across. V1's passages are already generated and audited, and they are the most expensive artifact in this repo.
- [ ] Remap `wordId` from this repo's cuids to Bayana's `Word.id`. `words/*.json` here is already an export of Bayana's corpus, so the join is reproducible from a clone, but not through the Anki guid: Bayana is dropping `guid` as identity because bayan-produced words cannot carry one. Its decided key is expression plus reading, which is ambiguous for 67 words in this corpus and affects 18 of the 496 questions. The measurements and the two ways out: [SPEC §14.4](SPEC.md#144-the-wordid-crosswalk).
- [ ] Fold `/admin`'s S-F rank review into Bayana's `UserProfile.role = ADMIN` rather than porting the `ADMIN_PASSWORD` HMAC path.

## Test coverage: gaps and plan

Coverage today is one tier deep: Vitest over server-side question assembly and the pure helpers in `app/utils/`, with nothing on components or routes. That tier is deliberate, but it leaves the gaps below. They are recorded here rather than in the port list because each one guards an invariant that moves to Bayana intact, so closing a gap here is worth roughly double.

- [ ] Assert answer secrecy at the route boundary, not only on `toClientQuestion`. `prepare.post.ts` projects at three separate call sites; a fourth response path that forgot the projection would ship correct answers to the client with the suite still green. The cheapest version asserts on the serialised response body of each `prepare` branch, the same way `answer-leakage.test.ts` asserts on the wire string.
- [ ] Cover the grading of unanswered questions. A blank `choiceId` grades to `correct: false`, not `null`, and so counts against the score. Nothing tests that today, and `type-accuracy.test.ts` exercises the `correct: null` case instead, which the type permits but the submit path never produces.
- [ ] Cover the budget path in `analysis.post.ts`. Two branches carry the entire cost guarantee and neither is tested: `consumeBudget()` returning false must short-circuit before any Anthropic call is constructed, and an already-stored `session.analysis` must be returned without spending budget at all.
- [ ] Cover orthography case 2 in `assembleQuestion`, where the word already appears in kana in the example sentence. Cases 1, 3 and 4 each have a fixture; case 2 is the only branch of the four with none.
- [ ] Decide whether component tests are worth a second tier. They need `@nuxt/test-utils` and the `test/nuxt/**` path that Nuxt's generated tsconfig already includes, which is why `tsconfig.test.json` exists alongside it. Only `TypeChart.vue` clearly earns one, because its polar math is the sort of thing that breaks silently and looks plausible.

## Known issues

Small, known, and not yet fixed. None of them affect scoring or answer secrecy.

- [ ] `useSessionAnalysis` declares the analysis response as `{ analysis: string }`, but `/api/session/analysis` returns `{ analysis: null }` both when the daily budget is spent and when the upstream call fails. No runtime bug today, since the value lands in a `string | null` ref, but the declared type says a null is impossible.
- [ ] The results page renders "Today's AI analysis quota has been reached" before the spinner, because `loading` starts false and only flips in `onMounted`. It appears in the server-rendered HTML, so on a reloaded or shared results URL it is visible until hydration. Fixing it needs care: initialising `loading` to true leaves a permanent spinner when no `sessionId` is present.
- [ ] The 30-minute vocab timer is display only. It clamps at `00:00` and nothing auto-submits, so the timed section does not actually enforce its time limit.
- [ ] Pressing Enter may advance two questions when a nav button holds focus, since the window key handler and the button's own native click both fire. Unconfirmed in a browser.

## Upcoming

### V1: Reading Section

**Schema and seeding:**

- [ ] Add `Passage` and `ReadingQuestion` models to `prisma/schema.prisma`
  - `Passage(id, level, subtype, title?, text, notes Json?)` with `ReadingQuestion[]`
  - `ReadingQuestion(id, passageId, stem, correctAnswer, distractors Json, explanation)`
- [ ] Write `prisma/seed-reading.ts`, upserting from `passages-n3.json`

**Session flow:**

- [ ] Add `SessionMode = 'reading'`. A reading session serves a set of passages, not individual questions.
- [ ] `POST /api/session/prepare` reading branch: sample passages by subtype (N3 exam ratio: 4 short + 2 medium + 1 long + 1 info = 8 passages, 16 questions)
- [ ] `POST /api/session/submit`: adapt to reading sessions (answers keyed by `ReadingQuestion.id`)
- [ ] `GET /api/session/results`: reading session results

**UI, passage-visible reading:**

- INVARIANT: all questions for a passage are answered while the passage is visible on screen. This is how the real JLPT exam works. The passage never disappears until all its questions are answered.
- [ ] `ReadingCard.vue`: passage text (scrollable) plus current question plus choices, all on one screen. Desktop puts the passage left and questions right; mobile (412px) puts the passage above with a collapse toggle and the question and choices below.
- [ ] Within a passage: Q1 to Q2 to Qn navigation, passage stays visible
- [ ] Between passages: passage changes, Q counter resets, overall progress bar shows passages done
- [ ] `results.vue`: reading results, per-passage breakdown with the passage text visible on review

### V2: Grammar Section

- [ ] Grammar question types (particle choice, conjugation, sentence structure)
- [ ] Grammar item data model
- [ ] Grammar question assembly path

### V3: Listening Section

- [ ] Audio content sourcing or AI script generation
- [ ] Audio delivery (CDN or streaming)
- [ ] In-page audio player UI
- [ ] Listening question types matching JLPT format

### V3.5: User Accounts and Mistake Notebook

*Consider after the full exam excluding listening ships.*

- [ ] User authentication (email or OAuth)
- [ ] Per-user mistake log, recording each incorrect answer with `wordId`, `QuestionType`, and timestamp
- [ ] Mistake notebook view: browse and filter personal weak words by type
- [ ] Optional: spaced-repetition scheduling, surfacing weak words more often in new sessions

> Prerequisite: V1–V2 complete (vocab, reading and grammar available). The mistake log is most useful when all non-listening question types are seeded and a user can meaningfully track cross-section weaknesses. Listening (V3) can be added to the tracking system incrementally.

### V4: Real Exam Mode

- [ ] Section sequencing engine: vocab, then reading, then grammar, then listening, in one session
- [ ] Per-section timers matching actual JLPT time allocation
- [ ] Lock between sections: no early exit, no revisiting previous sections
- [ ] Single combined submission at the end of the full exam
- [ ] Combined results page: section scores, overall score, cross-section AI analysis
- [ ] Unlock N1–N5 with V4, once N3 is stable
- [ ] Re-enable on-demand AI *question generation*, deferred until all sections are fully seeded and real exam mode is complete (results analysis remains on-demand throughout)

## Done

### Demo / MVP: project setup

- [x] Nuxt 4 project scaffolded
- [x] Prisma schema created
- [x] Docker dev environment (Postgres 18)
- [x] `app/types/index.ts` defined

### Demo / MVP: server

- [x] `server/lib/prisma.ts` singleton
- [x] `server/utils/rateLimit.ts`
- [x] `server/utils/shuffle.ts` and `server/utils/assembleQuestion.ts`
- [x] `server/utils/wordIndex.ts`
- [x] `server/api/session/prepare.post.ts` (seed-pool sampling, no on-demand AI)
- [x] `server/api/session/submit.post.ts`
- [x] `server/api/session/results.get.ts`
- [x] `server/api/session/analysis.post.ts` (AI, rate-limited by DAILY_API_LIMIT)
- [x] `server/api/admin/questions/index.get.ts` (paginated, rank filter)
- [x] `server/api/admin/questions/[id].get.ts`
- [x] `server/api/admin/questions/[id].delete.ts`
- [x] `server/api/admin/questions/[id]/review.post.ts`
- [x] `server/api/admin/questions/bulk-delete.post.ts`
- [x] `server/utils/rank.ts` (majority-vote rank, unranked protected)

### Demo / MVP: client

- [x] `useQuiz` composable
- [x] `useSession` composable
- [x] Pinia session store (`app/stores/session.ts`)
- [x] `index.vue` (question-type picker)
- [x] `loading.vue`
- [x] `quiz.vue`
- [x] `results.vue` (score, whyWrong, AI analysis)
- [x] `error.vue` (styled 404/500)
- [x] `admin/index.vue` (paginated, rank filter, bulk delete)
- [x] `admin/[id].vue` (word card, distractors, explanation, review form)
- [x] `QuizCard`, `ChoiceButton`, `Explanation`, `ProgressBar`, `LoadingSpinner` components

### Demo / MVP: deployment and polish

- [x] Railway PostgreSQL connected
- [x] Deployed on Railway
- [x] Results page: `whyWrong` and the user's wrong choice for incorrect answers
- [x] Admin: review system (rank S–F, majority vote, bulk delete)
- [x] Unranked question deletion protection
- [x] All-kana word exclusion for reading and orthography types
- [x] Similar or near-identical distractor validation
- [x] README created
- [x] Product roadmap documented in SPEC.md

### Demo / MVP: vocab section expansion

- [x] `文脈規定` question type (問題3, contextual fill-in)
- [x] `用法` question type (問題5, correct usage)
- [x] Mixed vocab session (`SessionMode = 'vocab'`): 8-6-11-5-5 distribution, 35 questions in exam order
- [x] `SessionQuestion.type` column, tracking per-question type in mixed sessions
- [x] 30-minute countdown timer (vocab sessions only; amber at ≤5 min, red at ≤2 min)
- [x] Per-question type label in quiz header for vocab sessions
- [x] `results.get.ts`: per-question type lookup for mixed sessions
- [x] `generate-seed.ts`: contextual and usage generation prompts and validators
- [x] Seed data split by JLPT level (`questions-n3.json`); `seed.ts` reads all `questions-n*.json`
- [x] Index page redesign: vocab primary card with 問題1–5 sub-cards, Reading and Grammar coming-soon placeholders
- [x] BRAND.md overhaul, `main.css` aligned (AMOLED dark theme, spacing scale, tap targets)

### Demo / MVP: security hardening

- [x] Token-based auth guard for `/admin` (HMAC session cookie, constant-time compare, login throttle)
- [x] Security hardening for the Claude API and admin dashboard (see `SECURITY.md`)

### Demo / MVP: UX and data viz polish

- [x] Directional quiz card transitions: `<Transition name="quiz-forward|quiz-backward" mode="out-in">` with scoped keyframes, `prefers-reduced-motion` respected via global `animation-duration: 0.01ms` in `main.css`
- [x] Staggered result item animations: `slide-up` keyframe, `--i` CSS custom property drives `animation-delay`
- [x] Per-type accuracy radar chart (`app/components/results/TypeChart.vue`): hand-rolled SVG, N-vertex polygon (2–5 types), only tested types passed, structurally preventing the "untested reads as zero" visual collapse
- [x] Wrong-answer review queue: `useReviewQueueStore` (Pinia options store, self-managed localStorage at `kalima_review_v1`), `useReviewQueue` composable, `ReviewItem` type
- [x] Review session mode (`SessionMode = 'review'`): gold home-screen card, `reviewItems` payload to the prepare endpoint, server validates and deduplicates against a type whitelist, no timer
- [x] `prepare.post.ts` hardening: consistent word-not-found handling (`continue` in all assembly loops), `reviewItems[].type` validated against the whitelist before the Prisma query

### V1: passage generation (offline)

- [x] `scripts/generate-passages.ts`, generating `prisma/seed-data/passages-n3.json` (short×20, medium×10, long×5, info×10)
- [x] `scripts/audit-passages.ts`: structural audit, AI vocab check, `--fix` auto-regeneration for flagged passages
- [x] Passages reviewed and repaired via `--fix` mode, `passages-n3.json` finalised

### Tooling

- [x] Vitest suite over server-side question assembly and the pure `app/utils/` helpers
- [x] `tsconfig.test.json`, because `nuxi typecheck` only covers `test/nuxt/**`
- [x] GitHub Actions CI: lint, both typechecks, tests and build on every push to `main` and every pull request
- [x] Quiz and results pages split into components, composables and pure helpers
