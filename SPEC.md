# Kalima — Technical Design Specification

| Field        | Value                                      |
|--------------|--------------------------------------------|
| **Status**   | Superseded (2026-07-25); see [TODO.md](TODO.md#status-superseded-2026-07-25) |
| **Author**   | chairulakmal                                      |
| **Created**  | 2026-06-06                                 |
| **Updated**  | 2026-08-06                                 |
| **Reviewers**| —                                          |

---

## Abstract

Kalima is a full-stack JLPT mock exam app on Nuxt 4. The current build is a **recruiter-ready demo** covering all five N3 vocabulary question types: 漢字読み (reading), 表記 (orthography), 文脈規定 (contextual), 言い換え類義 (synonym), 用法 (usage). Questions are pre-generated offline and committed as seed data. Users practise each type individually (10 questions) or sit the full section in exam order under a 30-minute timer (35 questions, 8-6-11-5-5). Answer validation is strictly server-side, and a Sonnet-powered performance analysis is generated on demand after each session. The homepage is intentionally public and unauthenticated, so a recruiter can try it immediately.

**Kalima is being merged into [Bayana](https://bayana.chairulakmal.com)**, the successor JLPT app. Decided 2026-07-25; the port is still to come, and until then this deployment stays live and public. Sections 1 to 13 describe what is built and running. **§14 (Port Surface) is written for the agent doing that port**: what moves, what gets re-decided, what stays here, the exact shape of every artifact, and the crosswalk that maps this repo's word IDs onto Bayana's. §15 (Product Roadmap) is kept as a porting reference, not a plan. Reasoning and port order: [TODO.md](TODO.md#status-superseded-2026-07-25).

---

## Table of Contents

1. [Background](#1-background)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [System Overview](#3-system-overview)
4. [Data Model](#4-data-model)
   - 4.1 [TypeScript Types](#41-typescript-types)
   - 4.2 [Prisma Schema](#42-prisma-schema)
5. [API Contracts](#5-api-contracts)
   - 5.1 [POST /api/session/prepare](#51-post-apisessionprepare)
   - 5.2 [POST /api/session/submit](#52-post-apisessionsubmit)
   - 5.3 [GET /api/session/results](#53-get-apisessionresults)
   - 5.4 [POST /api/session/analysis](#54-post-apisessionanalysis)
   - 5.5 [POST /api/admin/auth](#55-post-apiadminauth)
   - 5.6 [POST /api/admin/logout](#56-post-apiadminlogout)
   - 5.7 [GET /api/admin/me](#57-get-apiadminme)
   - 5.8 [GET /api/admin/questions](#58-get-apiadminquestions)
   - 5.9 [GET /api/admin/questions/:id](#59-get-apiadminquestionsid)
   - 5.10 [POST /api/admin/questions/:id/review](#510-post-apiadminquestionsidreview)
   - 5.11 [DELETE /api/admin/questions/:id](#511-delete-apiadminquestionsid)
   - 5.12 [POST /api/admin/questions/bulk-delete](#512-post-apiadminquestionsbulk-delete)
6. [AI Integration](#6-ai-integration)
   - 6.1 [Seed Question Generation](#61-seed-question-generation-offline-committed)
   - 6.2 [Session Analysis](#62-session-analysis)
7. [Client Cache](#7-client-cache)
8. [Rate Limiting](#8-rate-limiting)
9. [Question Assembly](#9-question-assembly)
10. [Security Model](#10-security-model)
11. [Testing and CI](#11-testing-and-ci)
12. [Alternatives Considered](#12-alternatives-considered)
13. [Open Questions](#13-open-questions)
14. [Port Surface](#14-port-surface)
    - 14.1 [What the target is](#141-what-the-target-is)
    - 14.2 [Verdict per module](#142-verdict-per-module)
    - 14.3 [Artifacts and their exact shapes](#143-artifacts-and-their-exact-shapes)
    - 14.4 [The wordId crosswalk](#144-the-wordid-crosswalk)
    - 14.5 [Invariants that must survive, and what pins each](#145-invariants-that-must-survive-and-what-pins-each)
    - 14.6 [Do not port](#146-do-not-port)
15. [Product Roadmap](#15-product-roadmap)
16. [Revision History](#16-revision-history)

---

## 1. Background

JLPT vocabulary practice tools typically present static question banks. Kalima
differentiates by generating contextually appropriate distractors per word via LLM,
making each incorrect choice plausibly confusable rather than randomly picked. This
increases the diagnostic value of wrong answers and produces richer post-session
feedback.

The product is a demonstration-scale deployment: approximately 10 sessions per day,
one shared PostgreSQL instance, no user accounts, and a hard cap on daily Anthropic API
calls. These constraints inform several design decisions documented below.

---

## 2. Goals and Non-Goals

### Goals

- Provide JLPT N3 vocabulary sessions sampled from a pre-seeded pool — no on-demand question generation during a session.
- Support five question types: 漢字読み (`reading`), 表記 (`orthography`), 文脈規定 (`contextual`), 言い換え類義 (`synonym`), 用法 (`usage`).
- Support a mixed `vocab` session mode: 35 questions in exam order (8 reading, 6 orthography, 11 contextual, 5 synonym, 5 usage) with a 30-minute countdown timer.
- Validate answers server-side so correct answers are never exposed to the client during an active session.
- Deliver a comprehensive performance analysis after each session via `claude-sonnet-4-6`.
- Enforce a configurable daily cap (`DAILY_API_LIMIT`) on analysis calls.
- Survive a mid-quiz page refresh without data loss.
- Expose a `/admin` audit page listing all seed questions with a human review system (rank S–F, majority vote).

### Non-Goals

- **On-demand AI question generation during a session.** Questions are pre-seeded; `scripts/generate-seed.ts` is the only path to new questions. Re-enabling live generation is deferred until all exam sections are fully seeded (V4).
- **On-demand AI beyond results analysis.** The only live Anthropic call is `POST /api/session/analysis`. This remains the sole on-demand AI call indefinitely.
- **Authentication on the demo homepage.** The `/` quiz is intentionally public. V1+ features will be gated.
- **N1, N2, N4, N5 level support.** Word lists for all levels exist at `/words/`; only N3 is active. Enabling additional levels requires no schema changes.
- User accounts or cross-session progress tracking.
- Real-time collaboration or multiplayer modes.

Per-IP rate limiting was a non-goal in the original draft and shipped anyway: the 2026-06-07 hardening review added throttles to `analysis`, `prepare`, and admin login beneath the shared daily budget (§8, `SECURITY.md`).

---

## 3. System Overview

```
Browser
│
├─ index.vue        Mode picker. User selects a SessionMode (single type, full vocab, or review).
│                   Review card visible when localStorage queue is non-empty (useReviewQueueStore.count > 0).
│                   → navigates to /loading?level=N3&type={mode}.
│
├─ loading.vue      For review mode: reads queue via useReviewQueue().getQueueForSession(),
│                   posts { level, type: 'review', reviewItems } to /api/session/prepare.
│                   For all modes: stores { sessionId, questions, type } in Pinia + localStorage.
│                   Navigates to /quiz on success.
│
├─ quiz.vue         Displays one ClientQuestion at a time.
│                   Answers collected locally — no server calls per question.
│                   Card-to-card navigation uses directional Vue <Transition> (slide left/right).
│                   For vocab sessions: 30-minute countdown timer with colour shifts
│                   at ≤5 min (amber) and ≤2 min (red). No auto-submit.
│                   Per-question type label shown in header for vocab and review sessions.
│                   On "Submit Test" (last question): POST /api/session/submit
│                   with all answers at once. Navigates to /results on success.
│                   No correctness feedback shown during the quiz.
│
└─ results.vue      GET /api/session/results → score, time, breakdown + explanations.
                    Per-type accuracy radar chart shown for vocab/review sessions (≥2 types).
                    Wrong answers upserted to review queue; correct review answers pruned.
                    POST /api/session/analysis → AI paragraph (async, shown when ready).
                    "Try Again" clears cache and returns to index.vue.

Server
│
├─ POST /api/session/prepare
│   Single-type (type ≠ 'vocab'):
│     1. Query ExamQuestion WHERE model='seed' AND type=requestedType (pool of up to 100).
│     2. Shuffle pool; pick 10.
│     3. Assemble 10 Questions server-side; shuffle choices.
│     4. Persist Session + 10 SessionQuestion rows (each with type set).
│     5. Return ClientQuestion[10].
│   Vocab mode (type = 'vocab'):
│     1. For each of [reading×8, orthography×6, contextual×11, synonym×5, usage×5]:
│        query pool, sample count, assemble questions.
│     2. Concatenate in exam order (globalOrder 0–34).
│     3. Persist Session + 35 SessionQuestion rows (each with its own type).
│     4. Return ClientQuestion[35].
│
├─ POST /api/session/submit
│   Receive all answers at once. Compare each choiceId against DB correctChoiceId;
│   update SessionQuestion.userChoiceId and correct. Return { ok: true }.
│
├─ GET /api/session/results
│   Look up each SessionQuestion's ExamQuestion by (wordId, sq.type).
│   Return score, timeTaken, QuestionResult[] with per-question type, prompt,
│   correctAnswer, explanation, whyWrong (wrong answers only).
│
├─ POST /api/session/analysis
│   Compute stats. Call claude-sonnet-4-6. Persist + return analysis paragraph.
│
└─ /api/admin/*        All guarded by server/middleware/admin-auth.ts (HMAC cookie,
    │                  constant-time compare, fail-closed). auth guards itself.
    ├─ POST   /auth                      Password → admin_session cookie. 5 tries / 15 min per IP.
    ├─ POST   /logout                    Clear the cookie.
    ├─ GET    /me                        Session probe for the client route guard.
    ├─ GET    /questions                 Paginated ExamQuestion rows (25/page), rank filter.
    ├─ GET    /questions/:id             Full detail for one row: word lookup + reviews.
    ├─ POST   /questions/:id/review      Upsert this admin's S–F rank; returns effective rank.
    ├─ DELETE /questions/:id             Delete one row. Blocked for S/A/B and unranked.
    └─ POST   /questions/bulk-delete     Delete every row whose effective rank equals {rank}.

Persistence
├─ PostgreSQL (Railway)   Session · SessionQuestion · ExamQuestion · ExamQuestionReview · RateLimit
└─ localStorage           Active session cache (sessionId + ClientQuestion[] + type)
```

---

## 4. Data Model

### 4.1 TypeScript Types

```typescript
// app/types/index.ts

export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

// The JLPT vocabulary question type a single question belongs to.
//   reading     — 問題1 漢字読み: pick the correct kana reading of the underlined kanji word
//   orthography — 問題2 表記: pick the correct kanji for the underlined hiragana word
//   contextual  — 問題3 文脈規定: pick the word that best fills the blank in the sentence
//   synonym     — 問題4 言い換え類義: pick the closest synonym, substitutable in context
//   usage       — 問題5 用法: pick the sentence that uses the word correctly
export type QuestionType = 'reading' | 'orthography' | 'contextual' | 'synonym' | 'usage'

export const QUESTION_TYPES: QuestionType[] = ['reading', 'orthography', 'contextual', 'synonym', 'usage']

// Session-level mode: either a single question type, the mixed full-vocab section, or a review session.
//   vocab   — 35-question mixed session: 8 reading + 6 orthography + 11 contextual + 5 synonym + 5 usage
//   review  — up to 10 questions drawn from the user's wrong-answer queue (specific wordId+type pairs)
export type SessionMode = QuestionType | 'vocab' | 'review'

// ── Source data ──────────────────────────────────────────────────────────────

export interface Word {
  id: string
  guid: string
  expression: string         // kanji/word — e.g. "結果"
  reading: string            // kana — e.g. "けっか"
  meaning: string            // English — e.g. "result, outcome"
  level: Level
  tags: string[]
  exampleSentence?: {
    japanese: string
    reading: string
    english: string
  }
}

// ── AI-generated artefacts ───────────────────────────────────────────────────

export interface ExamDistractor {
  text: string
  whyWrong?: string          // stored in DB; surfaced on results page for wrong answers
}

// ── Session types ────────────────────────────────────────────────────────────

export interface Choice {
  id: string
  text: string
  isCorrect: boolean         // server-side only; never sent to client
}

export interface ClientChoice {
  id: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  wordId: string
  prompt: string             // the underlined token, or the whole sentence for contextual (see §9)
  context?: string           // the sentence `prompt` sits in; set for reading, orthography, synonym
  correctAnswer: string      // server-side only; never sent to client
  choices: Choice[]          // shuffled server-side
  explanation: string        // server-side only; withheld until session ends
}

// Safe client projection returned from POST /api/session/prepare
export interface ClientQuestion {
  id: string
  type: QuestionType
  wordId: string
  prompt: string
  context?: string
  choices: ClientChoice[]    // shuffled; no isCorrect
}

export interface Answer {
  questionId: string
  choiceId: string
  isCorrect: boolean
  timeSpentMs: number
}

export interface TestSession {
  id: string
  level: Level
  questionCount: number      // 10 (single-type or review) or 35 (vocab)
  questions: Question[]
  answers: Answer[]
  startedAt: number
  completedAt?: number
}

// ── Results types ────────────────────────────────────────────────────────────

// One radar vertex. Only types the session actually tested get an entry, so a
// missing type is absent rather than plotted at zero.
export interface TypeEntry {
  type: QuestionType
  label: string
  correct: number
  total: number
  pct: number
}

export interface QuestionResult {
  questionId: string
  wordId: string
  type: QuestionType         // per-question type; required for mixed vocab sessions
  prompt: string
  reading: string
  meaning?: string
  correctAnswer: string
  correctAnswerReading?: string
  userChoiceId: string | null
  userChoiceText?: string    // present only for wrong answers
  correct: boolean | null
  explanation: string
  whyWrong?: string          // present only for wrong answers; from ExamDistractor.whyWrong
  exampleSentence?: { japanese: string; reading: string; english: string }
}

export interface SessionStats {
  score: number
  totalQuestions: number     // 10 (single-type or review) or 35 (vocab)
  wrongWords: string[]
  weakTags: string[]
  avgTimePerQuestion: number // milliseconds
}

// ── Review queue ─────────────────────────────────────────────────────────────

export interface ReviewItem {
  wordId: string
  type: QuestionType
  prompt: string    // expression (or reading for contextual) — displayed in the queue badge
  failedAt: number  // ms timestamp; queue is drawn oldest-first
}
```

### 4.2 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Session {
  id          String            @id @default(cuid())
  level       String
  type        String            @default("synonym")  // SessionMode value
  questions   SessionQuestion[]
  analysis    String?
  startedAt   DateTime          @default(now())
  completedAt DateTime?
}

// One row per (word, question type). Reused across sessions.
model ExamQuestion {
  id             String               @id @default(cuid())
  wordId         String
  type           String               // 'reading' | 'orthography' | 'contextual' | 'synonym' | 'usage'
  correctAnswer  String
  correctReading String?              // kana reading of correctAnswer; present for reading/contextual
  distractors    Json                 // ExamDistractor[]
  explanation    String
  version        Int                  @default(1)
  model          String               // model ID used for generation, e.g. "seed"
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  reviews        ExamQuestionReview[]

  @@unique([wordId, type])
  @@index([wordId])
}

// One review per (question, reviewer). Rank S–F; majority vote determines effective rank.
model ExamQuestionReview {
  id             String       @id @default(cuid())
  examQuestionId String
  examQuestion   ExamQuestion @relation(fields: [examQuestionId], references: [id], onDelete: Cascade)
  reviewerEmail  String
  rank           String       // 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  note           String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([examQuestionId, reviewerEmail])
  @@index([examQuestionId])
}

model SessionQuestion {
  id              String   @id @default(cuid())
  sessionId       String
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  wordId          String
  type            String   @default("synonym")  // per-question QuestionType; required for vocab sessions
  correctChoiceId String                         // server-side truth; never sent to client
  userChoiceId    String?
  correct         Boolean?
  choicesJson     Json                           // Choice[] with isCorrect; server-side only
  explanation     String
  order           Int                            // 0-indexed position within session

  @@index([sessionId])
}

// One row per calendar day. Tracks live Anthropic API calls (analysis only).
model RateLimit {
  id           String   @id @default(cuid())
  date         String   @unique       // "YYYY-MM-DD" UTC
  requestCount Int      @default(0)
  updatedAt    DateTime @updatedAt
}
```

---

## 5. API Contracts

All endpoints return `Content-Type: application/json`.

Errors are raised with h3's `createError({ statusCode, message })`, so the serialized body is
h3's standard shape — `{ statusCode, statusMessage, message, url, ... }`. There is **no application-level
`code` field**; the tables below list the literal `message` each condition produces. Clients should
branch on `statusCode`, not on message text.

---

### 5.1 POST /api/session/prepare

Prepares a session. Called once from `loading.vue`.

**Request body**
```typescript
// Fresh session
{ level: Level; type: SessionMode }
// Review session
{ level: Level; type: 'review'; reviewItems: { wordId: string; type: string }[] }
```

**Response (200 OK)**
```typescript
{
  sessionId: string
  questions: ClientQuestion[]  // 10 items for single-type or review; 35 for 'vocab'
}
```

**Error responses**

| Status | `message`                                          | Condition                                       |
|--------|----------------------------------------------------|-------------------------------------------------|
| 400    | `Invalid level`                                    | `level` not recognised                          |
| 400    | `Review queue is empty`                            | `reviewItems` missing or empty                  |
| 400    | `No valid question types in review items`          | every `reviewItems` entry has an unknown type   |
| 429    | `Too many requests. Try again later.`              | per-IP throttle (30 per 10 min)                 |
| 503    | `Seed questions not loaded. Run db:seed first.`    | seed pool empty                                 |
| 503    | `No seed questions for type "<type>". Run db:seed first.` | pool empty for a required type            |
| 503    | `No questions found for review items`              | no rows match the requested (wordId, type) pairs |

**Server-side flow — single-type session**

1. Validate `level` and `type`.
2. Query `ExamQuestion WHERE model='seed' AND type=requestedType` (pool up to 100).
3. If pool is empty, return HTTP 503.
4. Shuffle pool; take 10.
5. Load word metadata from `words/${level}.json`.
6. Assemble 10 `Question` objects; shuffle choices. Skip any `wordId` not present in the word list.
7. Persist `Session` (type = requestedType) and 10 `SessionQuestion` rows (each with `type` set).
8. Project each `Question` to `ClientQuestion` via `toClientQuestion()`.
9. Return `{ sessionId, questions }`.

**Server-side flow — vocab session**

1. For each entry in `VOCAB_DISTRIBUTION` (`[reading×8, orthography×6, contextual×11, synonym×5, usage×5]`):
   - Query the seed pool for that type; shuffle; take the required count.
   - Assemble questions with a monotonically increasing `globalOrder` counter.
2. Concatenate all questions in problem order (reading first, usage last).
3. Persist `Session` (type = 'vocab') and 35 `SessionQuestion` rows, each tagged with its own `type`.
4. Return `{ sessionId, questions: ClientQuestion[35] }`.

**Server-side flow — review session**

1. Filter `reviewItems` to those with a valid `type` (whitelist: the five `QuestionType` values). Return 400 if none remain.
2. Deduplicate by `(wordId, type)`.
3. Fetch `ExamQuestion` rows matching any of the `(wordId, type)` pairs via Prisma `OR` query. Return 503 if no rows found.
4. Shuffle results; take up to 10.
5. Assemble questions (skip any `wordId` missing from the word list).
6. Persist `Session` (type = 'review') and `SessionQuestion` rows with each question's own `type`.
7. Return `{ sessionId, questions }`.

---

### 5.2 POST /api/session/submit

Submits all answers at once at the end of a quiz session. Called once from `quiz.vue`.

**Request body**
```typescript
{
  sessionId: string
  answers: { questionId: string; choiceId: string }[]
}
```

**Response (200 OK)**
```typescript
{ ok: true }
```

**Error responses**

| Status | `message`         | Condition                                     |
|--------|-------------------|-----------------------------------------------|
| 400    | `Invalid request` | `sessionId` absent or `answers` not an array  |

**Server-side flow**

1. Validate `sessionId` and `answers` array.
2. Fetch all `SessionQuestion` rows for `sessionId` in one query.
3. For each row where `userChoiceId` is already set, skip (idempotency).
4. For remaining rows, compare `choiceId` against `correctChoiceId`; update `userChoiceId`, `correct`, and `Session.completedAt` in a transaction.
5. Return `{ ok: true }`.

---

### 5.3 GET /api/session/results

Returns full results including explanations. Called once from `results.vue`.

**Query parameters**

| Parameter   | Type   | Required |
|-------------|--------|----------|
| `sessionId` | string | Yes      |

**Response (200 OK)**
```typescript
{
  sessionId: string
  level: string
  type: string              // SessionMode value stored on Session
  score: number
  totalQuestions: number    // 10 or 35
  startedAt: number
  completedAt: number
  results: QuestionResult[] // ordered by SessionQuestion.order
}
```

**Error responses**

| Status | `message`            | Condition                              |
|--------|----------------------|----------------------------------------|
| 400    | `sessionId required` | `sessionId` query param absent         |
| 404    | `Session not found`  | `sessionId` does not exist             |

There is **no** incomplete-session check: an unsubmitted session returns results, and
`results.get.ts` falls back to `new Date()` when `completedAt` is null.

**Server-side flow**

1. Load `Session` with all `SessionQuestion` rows.
2. Fetch `ExamQuestion` rows for all (wordId, type) pairs in one query using `OR`:
   ```typescript
   OR: session.questions.map(sq => ({ wordId: sq.wordId, type: sq.type }))
   ```
   Key by `${wordId}::${type}` for O(1) lookup.
3. Load word metadata from the word-list JSON for all wordIds.
4. For each `SessionQuestion`, reconstruct the prompt by type (`results.get.ts:62-74`):
   - `orthography`: `word.reading` — the kana. **Not `expression`**: 問題2 shows the reading and asks
     for the kanji, so prompting with `expression` would leak the answer.
   - `contextual`: replace the target in `exampleSentence.japanese` with `（　　）`, choosing whichever
     of `expression` / `reading` actually occurs in the sentence; falls back to `expression` if neither does.
   - everything else (`reading`, `synonym`, `usage`): `word.expression`.
5. Build `QuestionResult` per question. For incorrect answers, match the chosen distractor
   text against `ExamQuestion.distractors` to recover `whyWrong`.
6. `exampleSentence` is returned for **every** type, including `contextual` — it is not suppressed.

---

### 5.4 POST /api/session/analysis

Generates an AI performance analysis using `claude-sonnet-4-6`. Called once from `results.vue`.
**Subject to the shared `DAILY_API_LIMIT` counter.**

**Request body**
```typescript
{ sessionId: string }
```

**Response (200 OK)**
```typescript
{
  analysis: string | null  // null when daily limit is reached; UI silently omits the panel
}
```

**Error responses**

| Status | `message`                             | Condition                          |
|--------|---------------------------------------|------------------------------------|
| 400    | `Invalid request`                     | `sessionId` body field absent      |
| 404    | `Session not found`                   | `sessionId` does not exist         |
| 429    | `Too many requests. Try again later.` | per-IP throttle (10 per hour)      |

Budget exhaustion is **not** an error: it returns `200 { analysis: null }` and the results page
silently omits the panel.

**Server-side flow**

1. If `Session.analysis` is already populated, return the cached value immediately.
2. Call `consumeBudget()` — a single atomic upsert+increment that reserves a slot and reports
   whether it landed within `DAILY_API_LIMIT`. If it did not, return `{ analysis: null }`.
   (This replaced an earlier check-then-increment pair, which was a TOCTOU race — see SECURITY.md C2.
   The read-only `canGenerate()` still exists in `rateLimit.ts` but is unused.)
3. Load session, questions, and word metadata.
4. Call `claude-sonnet-4-6` (see §6.2).
5. Persist the returned paragraph to `Session.analysis`.
6. Return `{ analysis }`.

---

### Admin endpoints (§5.5 to §5.12)

`server/middleware/admin-auth.ts` guards every `/api/admin/*` route, requiring an `admin_session` cookie equal to `adminSessionToken()` (constant-time compare). `POST /api/admin/auth` is the one exception; it guards itself. The guard is **fail-closed**: with `ADMIN_PASSWORD` unset, `adminSessionToken()` returns null and every route, login included, denies access. All eight share one error row:

| Status | `message`      | Condition                                            |
|--------|----------------|------------------------------------------------------|
| 401    | `Unauthorized` | Cookie absent, mismatched, or `ADMIN_PASSWORD` unset |

Auth mechanics: `SECURITY.md`. Rank semantics (`server/utils/rank.ts`): majority vote across a question's reviews, ties breaking toward the worst rank, no reviews meaning `null` (unranked). `S`, `A`, `B`, and `null` are **protected** from deletion.

---

### 5.5 POST /api/admin/auth

Exchanges the admin password for a session cookie. Called from `admin/login.vue`. Not covered by the middleware guard; it throttles itself.

**Request body**
```typescript
{ password: string }
```

**Response (200 OK)**
```typescript
{ ok: true }
```

On success, sets `admin_session` to an HMAC-derived token (never the password) with `httpOnly`, `sameSite: 'strict'`, `secure` in production, `path: '/'`, `maxAge` 7 days.

| Status | `message`                              | Condition                                                    |
|--------|----------------------------------------|--------------------------------------------------------------|
| 401    | `Invalid password`                     | Wrong password, non-string body, or `ADMIN_PASSWORD` unset    |
| 429    | `Too many attempts. Try again later.`  | per-IP throttle (5 per 15 min)                                |

Note the 429 message differs from the session endpoints' `Too many requests. Try again later.`

---

### 5.6 POST /api/admin/logout

Clears the `admin_session` cookie. Returns `{ ok: true }` unconditionally.

---

### 5.7 GET /api/admin/me

Session probe for `app/middleware/admin.global.ts`, which uses it to decide whether to redirect to the login page. Returns `{ ok: true }` when the guard passes; the guard's 401 is the negative answer. No user identity: there is one shared credential.

---

### 5.8 GET /api/admin/questions

Returns a paginated list of `ExamQuestion` rows for audit.

**Query parameters**

| Parameter | Type   | Default | Description                                            |
|-----------|--------|---------|--------------------------------------------------------|
| `page`    | number | 1       | 1-indexed; values below 1 are clamped to 1              |
| `rank`    | string | none    | Filter by effective rank (`S`–`F`, or `unranked`)       |

Page size is fixed at 25. All rows are fetched and ranked in memory before filtering and slicing, which is fine at 496 rows and noted as such in the handler.

**Response (200 OK)**
```typescript
{
  questions: {
    id, wordId, type, model, explanation, version, createdAt,
    reviewCount: number,
    effectiveRank: Rank | null,
    deletable: boolean,
  }[]
  total: number         // count after rank filtering
  page: number
  pageSize: number      // always 25
  totalPages: number    // at least 1
  rankFilter: string | null
}
```

---

### 5.9 GET /api/admin/questions/:id

Returns full detail for a single `ExamQuestion`, including word lookup and reviews.

**Response (200 OK)**
```typescript
{
  id: string
  wordId: string
  type: string
  model: string
  version: number
  correctAnswer: string
  correctReading: string | null
  distractors: ExamDistractor[]
  explanation: string
  effectiveRank: string | null
  reviews: { rank, note, createdAt }[]
  createdAt: string
  updatedAt: string
  word: Word | null
}
```

**Error responses**

| Status | Condition                  |
|--------|----------------------------|
| 400    | `id` param absent          |
| 404    | `id` does not exist in DB  |

---

### 5.10 POST /api/admin/questions/:id/review

Records this admin's S to F rank and returns the recomputed effective rank. Upserts on `(examQuestionId, reviewerEmail)` with `reviewerEmail` hardcoded to `'admin'`, so each question resolves to a single review today; the majority vote in `rank.ts` waits for more reviewer identities.

**Request body**
```typescript
{ rank: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'; note?: string }
```

An empty or whitespace-only `note` is stored as `null`.

**Response (200 OK)**
```typescript
{
  reviews: ExamQuestionReview[]   // all reviews for this question, newest updatedAt first
  effectiveRank: Rank             // never null here: the upsert guarantees one review
  deletable: boolean              // false for S, A, B
}
```

| Status | `message`                          | Condition                        |
|--------|------------------------------------|----------------------------------|
| 400    | `id required`                      | `id` route param absent          |
| 400    | `rank must be one of S, A, B, C, D, F` | `rank` not in `RANKS`        |
| 404    | `Not found`                        | `id` does not exist in DB        |

---

### 5.11 DELETE /api/admin/questions/:id

Deletes one `ExamQuestion`, subject to rank protection. Cascades to its `ExamQuestionReview` rows.

**Response (200 OK)**
```typescript
{ ok: true }
```

| Status | `message`                                                              | Condition                       |
|--------|------------------------------------------------------------------------|---------------------------------|
| 400    | `id required`                                                          | `id` route param absent         |
| 403    | `Cannot delete an unranked question. Rate it C, D, or F first.`        | effective rank is `null`        |
| 403    | `Cannot delete a question ranked <rank>. Change rank to C, D, or F first.` | effective rank is S, A, or B |
| 404    | `Not found`                                                            | `id` does not exist in DB       |

The protection is the point: a cleanup pass can only remove content someone explicitly rated as poor.

---

### 5.12 POST /api/admin/questions/bulk-delete

Deletes every question whose **effective** rank equals the requested one, so it deletes by majority-vote outcome rather than by any individual review.

**Request body**
```typescript
{ rank: 'C' | 'D' | 'F' }
```

**Response (200 OK)**
```typescript
{ deleted: number }   // 0 when no question resolves to that rank
```

| Status | `message`                                | Condition                                        |
|--------|------------------------------------------|--------------------------------------------------|
| 400    | `Invalid rank`                           | `rank` absent or not in `RANKS`                  |
| 403    | `Rank <rank> is protected …`             | `rank` is S, A, or B (see `bulk-delete.post.ts`) |

There is no bulk path for unranked questions: `unranked` is not a member of `RANKS`, so it fails the 400 check before protection is considered.

---

## 6. AI Integration

**Question generation** (offline only, `scripts/generate-seed.ts`) uses `claude-sonnet-4-6`.
**Session analysis** (`POST /api/session/analysis`) uses `claude-sonnet-4-6` and is the only live Anthropic call. On-demand question generation is permanently disabled until V4 (all exam sections seeded).

> **Question format reference:** `questions/README.md` documents universal AI generation rules and the live output contract. Per-type prompt rules (vocab types) are in `questions/vocab.md`.

---

### 6.1 Seed Question Generation (offline, committed)

Questions are **not** generated on demand during a session. `scripts/generate-seed.ts` is run offline to produce `prisma/seed-data/questions-n3.json`. `prisma/seed.ts` upserts these rows into `ExamQuestion` with `model='seed'` on each deploy; the `model` value is set by the seed script, not carried in the JSON.

> **The generator is not in this repo.** `scripts/` and `questions/` are gitignored, so `generate-seed.ts` and the prompt-rule docs it reads exist only on the maintainer's machine. Its committed output is what ships, and everything below is a record of how that output was produced, not a path a reader can rerun from a clone.

**Pool:** 496 rows across five types (reading 100, orthography 96, contextual 100, synonym 100, usage 100), in `prisma/seed-data/questions-n3.json`. `prisma/seed.ts` reads every `questions-n*.json` file, so future levels need no code change.

**Committed but never loaded:** `prisma/seed-data/passages-n3.json`, 45 audited N3 reading passages (short×20, medium×10, long×5, info×10) generated ahead of the reading section. `seed.ts` matches only `questions-n*.json`, so nothing reads it today. It is the most expensive artifact here and first in the port list ([TODO.md](TODO.md#port-order)).

**Generation dispatch by type**

| Type | Correct answer source | Distractors |
|------|----------------------|-------------|
| `reading` | `word.reading` (ground truth) | 3 plausible misreadings (AI) |
| `orthography` | `word.expression` (ground truth) | 3 plausible kanji mis-spellings (AI) |
| `contextual` | `word.expression` or `word.reading` (whichever appears in sentence) | 3 same-POS words that don't fit the blank (AI) |
| `synonym` | AI-generated Japanese synonym | 3 near-synonyms with semantic contrast (AI) |
| `usage` | AI-generated sentence using the word correctly | 3 sentences with incorrect usage (AI) |

**Validation** (applied before persisting each row)

- Circular: distractor text matches `correctAnswer` or `word.reading` → reject
- Shared kanji: distractor shares a kanji character with `correctAnswer` → reject
- Duplicate: two distractors are identical → reject
- Contextual-specific: `word.expression` / `word.reading` not found in `exampleSentence.japanese` → ineligible word, skip

Full prompt rules remain documented in [`questions/README.md`](questions/README.md) and [`questions/vocab.md`](questions/vocab.md).

---

### 6.2 Session Analysis

**Model:** `claude-sonnet-4-6` · **max_tokens:** 700

Sonnet is used over Haiku because pattern recognition across 10–35 questions — identifying
semantic confusion, kanji misreading types, form/register errors — is meaningfully better.
Typical cost per analysis request: ~$0.009 (~600 input + ~450 output tokens).

**Prompt template**

```
A student just completed a JLPT {level} {type} vocabulary quiz.
Score: {correct}/{total}

Questions:
{for each question: ✓/✗ expression (reading) — meaning [ | chose "X", correct: "Y" ]}

Write a comprehensive 3–5 sentence performance analysis. Cover: (1) overall result,
(2) any patterns in the mistakes — e.g. similar word forms, reading errors, semantic
confusion — and (3) specific study advice tied to the words they missed. Be encouraging
and concrete. Reply with plain prose only — no markdown headers, no bullet points, no formatting.
```

The returned text is stored verbatim in `Session.analysis` and returned on subsequent calls
without invoking the API again. Returns `null` if the daily limit is exhausted.

---

## 7. Client Cache

The cache protects against data loss on accidental page refresh during a quiz.

**localStorage key:** `kalima_session_v1`

**Schema**
```typescript
{
  sessionId: string
  questions: ClientQuestion[]
  level: Level
  type: SessionMode          // 'vocab' | 'review' | QuestionType
  startedAt: number          // Unix timestamp (ms)
}
```

The wrong-answer queue is stored separately under `kalima_review_v1` as `ReviewItem[]`. It is managed by `useReviewQueueStore` (a separate Pinia options store) and persists across sessions and browser restarts.

**Lifecycle**

| Event | Action |
|-------|--------|
| `POST /api/session/prepare` succeeds | Write cache |
| `quiz.vue` mounts | Read cache; restore Pinia store |
| Session completes | Clear cache |
| User clicks "Try Again" | Clear cache |
| New session starts | Clear cache before writing new entry |

**Invariants**

- All access gated behind `if (import.meta.client)`.
- Pinia session store uses the options API (not setup store) so devalue serialization never traverses internal Vue ref objects during SSR.
- Cache never contains `isCorrect`, `correctAnswer`, or `explanation`.
- A stale `sessionId` (cache ≠ Pinia) is treated as a miss; cache is discarded.

---

## 8. Rate Limiting

**File:** `server/utils/rateLimit.ts`

**Scope:** Only `POST /api/session/analysis` consumes the counter. On-demand question generation is permanently disabled (§6.1). The counter name (`DAILY_API_LIMIT`) reflects the original design but now guards analysis only.

**Configuration:** `DAILY_API_LIMIT` environment variable (default: `10`).

**Implementation**

```typescript
function todayKey(): string {
  return new Date().toISOString().split('T')[0]  // "YYYY-MM-DD" UTC
}

// Atomic upsert+increment — race-free. Returns true if count is within limit.
export async function consumeBudget(): Promise<boolean> {
  const limit = parseInt(process.env.DAILY_API_LIMIT ?? '10', 10)
  const record = await prisma.rateLimit.upsert({
    where:  { date: todayKey() },
    update: { requestCount: { increment: 1 } },
    create: { date: todayKey(), requestCount: 1 },
  })
  return record.requestCount <= limit
}
```

**Known limitations (Demo)**

- Counter is shared across all users — no per-IP granularity. Per-IP throttling (`server/utils/throttle.ts`) sits underneath as defence in depth.
- The in-memory per-IP throttle (`throttle.ts`) resets on process restart and is not shared across instances. The persistent `RateLimit` row is the hard daily ceiling regardless.

---

## 9. Question Assembly

Assembly runs exclusively on the server. The client never receives a `Question`;
it only ever receives a `ClientQuestion`.

**`server/utils/assembleQuestion.ts`**

`promptAndContext(word, type)` decides what appears on screen: `prompt` is the underlined token and `context` is the sentence it sits in. `QuizCard` underlines `prompt` inside `context` by prefix match. Two types return no `context`, for different reasons: `contextual`'s prompt *is* the whole sentence, and `usage`'s choices are themselves full sentences, so a sentence around the word would compete with them.

| Type | `prompt` | `context` |
|------|----------|-----------|
| `reading` (問題1) | `word.expression` | the example sentence, unmodified |
| `orthography` (問題2) | `word.reading` | the sentence with the kanji hidden (four cases below) |
| `contextual` (問題3) | the sentence with the target replaced by `（　　）` | none |
| `synonym` (問題4) | `word.expression` | the example sentence, unmodified |
| `usage` (問題5) | `word.expression` | none |

**Orthography is the involved one.** 問題2 shows the word in kana and asks for the kanji, so the sentence must not contain the answer. Four cases, in order:

1. The kanji expression appears literally in the sentence: replace every occurrence with `word.reading`.
2. The word already appears in kana: use the sentence as-is.
3. The word appears **conjugated**, so neither form matches literally. Strip okurigana from `word.expression` to get the kanji root, find that root in the sentence, and replace it with the reading minus the same okurigana, leaving the surrounding conjugation kana intact. `QuizCard`'s prefix matching then underlines the stem, which is how the real paper prints it. Skipped if the substitution changes nothing.
4. No usable sentence, or none of the above matched: show the word alone with no context.

**Contextual** replaces whichever of `word.expression` / `word.reading` actually occurs in the sentence, falling back to `（　　）` plus the English meaning when the example sentence is missing or contains neither form.

At runtime every correct answer comes from `ExamQuestion.correctAnswer`; what differs is how it got there at seed time. `reading`, `orthography`, and `contextual` copy ground truth from the word data and were never AI-generated. `synonym` and `usage` are AI-generated, which is why the §6.1 validators work hardest on those two.

**Client-safe projection** (defined in `assembleQuestion.ts`, called by `prepare.post.ts` before the response is sent)

```typescript
export function toClientQuestion(q: Question): ClientQuestion {
  return {
    id: q.id,
    type: q.type,
    wordId: q.wordId,
    prompt: q.prompt,
    ...(q.context !== undefined && { context: q.context }),
    choices: q.choices.map((c: Choice) => ({ id: c.id, text: c.text })),
  }
}
```

`context` is spread conditionally so a question without one omits the key rather than sending `undefined`. Everything not listed is dropped: `isCorrect`, `correctAnswer`, and `explanation` have no path to the client during a quiz.

**Note on `whyWrong`:** `assembleQuestion` discards `whyWrong` from distractors during
question assembly. At results time, `GET /api/session/results` batch-fetches
`ExamQuestion.distractors` and matches by text to recover `whyWrong` for wrong answers.

---

## 10. Security Model

| Guarantee | Mechanism |
|-----------|-----------|
| Correct answers never reach the client during a quiz | `isCorrect` and `correctAnswer` stripped by `toClientQuestion`; stored in `choicesJson` and `correctChoiceId` server-side only |
| Explanations withheld during quiz | Not present in `ClientQuestion`; returned only by `GET /api/session/results` |
| Server-side answer validation | `POST /api/session/submit` compares each `choiceId` against DB `correctChoiceId`; correctness is never computed client-side |
| Double-submit idempotency | Rows with `userChoiceId` already set are silently skipped on re-submit |
| No per-question feedback during quiz | Submit endpoint returns only `{ ok: true }`; correct/wrong withheld until `GET /api/session/results` |
| Anthropic API key isolation | Used only in `server/` routes; never referenced in `app/` |
| Rate limit integrity | Persisted in PostgreSQL; cannot be reset by clearing localStorage or cookies |
| Admin page exposure | `SessionQuestion.correctChoiceId` and `choicesJson` are not returned by any admin endpoint |

---

## 11. Testing and CI

Coverage is deliberately **one tier deep**: Vitest over server-side assembly and the pure `app/utils/` helpers, nothing on components or routes. It pins the invariants that are expensive to get wrong (answer secrecy, per-type prompt shape, accuracy arithmetic) without paying for a component-rendering harness on a demo that is no longer taking features.

| File | What it pins |
|------|--------------|
| `test/server/answer-leakage.test.ts` | The client projection carries nothing identifying the correct choice. Asserts on the **serialised** response body, so a leak cannot hide behind a non-enumerable property or a nested object. |
| `test/server/assemble-question.test.ts` | Each question type builds the stem its 問題 format requires, including three of the four orthography cases in §9. |
| `test/app/type-accuracy.test.ts` | Per-type accuracy arithmetic, including the untested-type exclusion that keeps an absent type off the radar rather than plotting it at zero. |
| `test/fixtures.ts` | Shared `Word` and `ExamQuestion` fixtures. |

Known gaps, and why each one matters, are tracked in [TODO.md](TODO.md#test-coverage-gaps-and-plan). The load-bearing one: `toClientQuestion` is tested directly, but `prepare.post.ts` projects at three separate call sites, so a fourth response path that forgot the projection would ship answers to the client with the suite still green.

**Two TypeScript projects, both required.** Nuxt's generated tsconfigs include only `test/nuxt/**`, so `nuxi typecheck` cannot see `test/server/` or `test/app/`; `tsconfig.test.json` covers them via `npm run typecheck:test`. Run one without the other and half the repo goes unchecked.

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push to `main` and every PR: `prisma generate` first (the client is not committed and both the typecheck and the build need its types), then lint, both typechecks, tests, build. The build only needs `DATABASE_URL` to exist; nothing queries the database at build time.

---

## 12. Alternatives Considered

### 12.1 Client-side question assembly

**Considered:** Assemble questions in the browser after receiving the word list and distractors.

**Rejected:** The client would necessarily receive `isCorrect` flags and `correctAnswer` values,
making it trivial to cheat via DevTools. Server-side assembly and the `toClientQuestion`
projection eliminate this attack surface entirely.

---

### 12.2 Per-word AI calls instead of a single batch call

**Considered:** Issue one Anthropic API call per missing word during session preparation.

**Rejected:** A session with many missing words would require many sequential API calls,
increasing latency and cost. A single batched prompt achieves the same result in one round-trip.

---

### 12.3 Regenerate distractors every session

**Considered:** Generate fresh distractors for every word on every session.

**Rejected:** This would make every session subject to the rate limit and multiply API cost
proportionally with usage. Pre-seeded rows are consistent across sessions for the same word.

---

### 12.4 In-memory rate limit counter

**Considered:** Store the daily request count in a module-level variable.

**Rejected:** The counter would reset on every deployment or server restart. Railway's
deployment model means restarts are frequent. Persisting in PostgreSQL makes the counter
durable across process restarts.

---

### 12.5 Pinia as the sole session cache

**Considered:** Skip localStorage and rely exclusively on Pinia store.

**Rejected:** Pinia store is in-memory. A hard refresh during an active quiz would wipe
the `questions` array, requiring a new `POST /api/session/prepare` call. localStorage
makes refreshes transparent to the user at no additional cost.

---

### 12.6 Storing contextual prompt in ExamQuestion

**Considered:** Pre-compute and store the sentence-with-blank as a `context` field on `ExamQuestion`.

**Rejected:** The blank is always derived from `exampleSentence.japanese` by replacing
`word.expression` or `word.reading`. Computing it at runtime from the word JSON avoids a
schema change to `ExamQuestion` and keeps the prompt consistent if the word data changes.

---

## 13. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should `analysis` calls count against a separate daily budget, or be truly unlimited? | — | **Resolved 2026-06-07:** analysis is rate-limited via the shared `DAILY_API_LIMIT` counter. |
| 2 | The current fallback distractor strategy may produce low-quality choices for some words. Should fallback results be flagged in the DB for later regeneration? | — | Open |
| 3 | `ExamQuestion.version` is stored but never incremented. Define a policy for when regeneration should be triggered (e.g. model upgrade, quality threshold). | — | Open |
| 4 | The admin page is unauthed. Is an obscure URL acceptable long-term, or should a token-based guard be added before any public announcement? | — | **Resolved 2026-06-07:** HMAC token cookie + constant-time compare + brute-force throttle deployed in Demo. See `SECURITY.md`. |

---

## 14. Port Surface

Written for the agent porting Kalima into Bayana. Everything above this section describes what is built here; this section says what happens to it. Read §14.1 and §14.2 first, then §14.4 before writing any data code: the word crosswalk has a documented ambiguity that will silently mis-join 18 rows if it is missed.

### 14.1 What the target is

Bayana is a greenfield **Nuxt 4** app (decided 2026-07-26; before that the target was Next.js, and any doc that still says React is stale). That makes this a Nuxt-to-Nuxt port: server utilities, Nitro routes, Pinia stores and Vue SFCs **move** rather than get rewritten. Framework glue is the exception, not the rule.

Three constraints from the far side shape everything below, all recorded in Bayana's own `TODO.md`:

1. **Two gates come first.** bayan has to reach production (its `dataset/export.json` is still `{"count": 0}`), then Bayana's own Next-to-Nuxt migration has to land. The Kalima absorption is frozen behind both. Nothing here is urgent; it is meant to be correct when it is picked up.
2. **Bayana inherits neither this schema nor this database.** Its data model is being redesigned against three sources at once, and its production database is reset at cutover. So `prisma/schema.prisma` here is a reference, not a migration source, and **the only things that physically travel are the committed artifacts in §14.3 and the logic in §14.2.**
3. **The counterpart checklist lives in Bayana's `TODO.md`**, under "Kalima absorption" and "Consumer work, folded in from what was a separate gate". That file owns the target-side design; this section owns the source-side facts. Where they disagree about a fact measured here, this section is right.

### 14.2 Verdict per module

**Move** means copy the file and retarget its imports. **Re-decide** means the behaviour is wanted but the mechanism is not. **Leave** means it dies with this repo.

| Here | Verdict | Note |
|------|---------|------|
| `server/utils/assembleQuestion.ts` | **Move** | The load-bearing file. Imports only `./shuffle` and types, so it is portable as-is. Carries the four orthography cases (§9) and `toClientQuestion`. |
| `server/utils/shuffle.ts` | **Move** | Zero imports. |
| `app/utils/typeAccuracy.ts`, `app/utils/questionTypes.ts` | **Move** | Type-only imports. |
| `app/components/results/TypeChart.vue` | **Move** | Polar math plus hand-rolled SVG, one type-only import. Vue to Vue, so it survives the move intact; the "tested types only" rule in §14.5 is the part not to lose. |
| `server/api/session/{prepare,submit,results}.*` | **Move, retarget** | Nitro to Nitro. The Prisma calls change shape with Bayana's model; the flow (§5.1 to §5.3) does not. |
| `server/utils/rateLimit.ts` (`consumeBudget`) | **Move, retarget** | The atomic upsert is the durable half Bayana lacks: its `src/lib/rate-limit.ts` is in-memory and cannot bound spend across restarts or replicas. Port this before any Bayana route spends money. Its unused `canGenerate()` does not travel. |
| `server/api/session/analysis.post.ts` | **Move, retarget** | Cache-on-`Session.analysis` first, then `consumeBudget()`, then the call. Keep that order: it is what makes a revisit free. |
| `server/utils/throttle.ts` | **Re-decide** | Correct only because one replica handles all traffic (§8, ARCHITECTURE). Per-IP throttling is still wanted; in-process fixed windows are not. |
| `server/utils/wordIndex.ts` | **Re-decide** | Reads `words/*.json` off disk because this app has no word table. Bayana has `Word` rows, so this becomes a query. |
| `app/stores/reviewQueue.ts`, `app/composables/useReviewQueue.ts` | **Re-decide** | The queue behaviour ports; localStorage does not. Bayana rehomes it onto per-user rows, and its TODO asks whether it should feed `ReviewState` rather than sit beside it. |
| `server/utils/rank.ts`, `server/utils/adminAuth.ts`, `server/middleware/admin-auth.ts`, `app/middleware/admin.global.ts`, `app/pages/admin/*` | **Leave** | S-F majority-vote review folds into Bayana's admin page under `UserProfile.role = ADMIN`. The `ADMIN_PASSWORD` HMAC path is explicitly not ported (§14.6). |
| `prisma/schema.prisma` | **Leave** | Reference only, per §14.1 constraint 2. |
| `prisma/seed-data/*.json`, `words/*.json` | **Data, see §14.3** | These are the artifacts. Everything else is reproducible from source. |
| `test/` | **Move first** | Four files, and they are the acceptance checklist for the port (§14.5), not an afterthought. |

### 14.3 Artifacts and their exact shapes

Counts measured against the tree on 2026-08-06, not estimated. All three files are committed, so nothing in the running database is needed to reproduce them.

**`prisma/seed-data/questions-n3.json`**, 496 rows. Record keys: `wordId`, `type`, `correctAnswer`, `correctReading`, `distractors`, `explanation`.

- By type: `reading` 100, `orthography` 96, `contextual` 100, `synonym` 100, `usage` 100.
- Exactly 3 distractors per row (1488 total), each `{ text, whyWrong }`, and **`whyWrong` is populated on all 1488**. It is the results-page payload, so do not drop it in transit.
- `correctReading` is present on 396 rows, absent on all 100 `usage` rows (whose answer is a whole sentence).
- `model` is **not** in the JSON: `prisma/seed.ts` sets `model='seed'` at insert, and `prepare.post.ts` filters on it. Any importer has to supply the equivalent discriminator, which on Bayana's side is the `source` field its question store keeps for exactly this.

**`prisma/seed-data/passages-n3.json`**, 45 passages and 90 questions, committed but never loaded here (`seed.ts` matches only `questions-n*.json`). Passage keys: `id`, `level`, `subtype`, `text`, `questions`. Question keys: `id`, `stem`, `correctAnswer`, `distractors`, `explanation`, same 3-distractor `{ text, whyWrong }` shape.

- By subtype: `short` 20, `medium` 10, `long` 5, `info` 10.
- This is paid, audited AI output with no generator in the repo. It is the most expensive artifact here and the one with the least in-app justification for existing, which is precisely why it is easy to lose.

**`words/*.json`**, 8,101 words across five files, read via `fs` at request time. Keys: `id` (this repo's cuid), `guid`, `expression`, `reading`, `meaning`, `level`, `tags`, `exampleSentence { japanese, reading, english }`.

- By level: N1 2,699 · N2 1,905 · N3 2,111 · N4 668 · N5 718.
- **Every one of the 8,101 carries its `exampleSentence`.** This file set is an export of Bayana's own `Word` plus `ExampleSentence` corpus, so it is also a committed, version-controlled backup of those paid sentences, losing only `ExampleSentence.model` and `.source` provenance. Bayana's TODO treats a local `pg_dump` as their only copy; it is not.

### 14.4 The wordId crosswalk

`ExamQuestion.wordId` is a cuid minted in this repo. Bayana's `Word.id` is a different cuid. `words/*.json` is the join table between them, and it is committed, so the crosswalk is fully reproducible from a clone.

Measured facts, all of which the join has to respect:

- **All 496 question `wordId`s resolve** in `words/*.json`. There are no orphans to handle.
- The 496 questions cover **447 distinct words, all N3**.
- `id` and `guid` are both unique across all 8,101 rows.
- **`expression` + `reading` is not unique: 8,034 distinct keys, 67 collisions.** Every collision is the same word listed at two levels (下る, 不通, 中身, 乾かす, 争う and 62 more, each appearing as both N2 and N3).
- **18 of the 496 questions map to a word involved in one of those collisions**, across 16 words (活躍, 殴る, 容器, 鐘, 生年月日, 地味, 温まる, 飾り, 宣伝, 応援, 重体, 冷やす, 揃える, 湿度, 診る and one more).

The trap: Bayana has decided its vocabulary crosswalk is **expression plus reading**, because bayan-produced words deliberately carry no Anki identifier and `Word.guid` therefore stops being identity. Against this corpus that key is ambiguous for 67 words. Two ways out, and the choice belongs to Bayana's model redesign rather than to this file: either the join carries `level` as a tiebreaker (all Kalima questions are N3, so N3 wins every collision here), or Bayana's `Word` table collapses each colliding pair into one row and records which level it claims. Joining on `guid` works today but is a dead end, since it cannot survive the arrival of the first bayan-sourced word.

### 14.5 Invariants that must survive, and what pins each

Answer secrecy is the property the mock exam is built around; Bayana's own list says to port it first, not last. Each row below is a behaviour to re-establish on the far side, with the mechanism that implements it here and the test that would catch its loss.

| Invariant | Mechanism here | Pinned by |
|-----------|----------------|-----------|
| No answer material reaches the client during a quiz | `toClientQuestion` projection, opaque per-session choice UUIDs, `correctChoiceId` held in `SessionQuestion` | `test/server/answer-leakage.test.ts`, asserting on the **serialised** body |
| Grading is server-side and idempotent | `submit.post.ts` compares IDs, skips rows whose `userChoiceId` is set | not covered; see [TODO.md](TODO.md#test-coverage-gaps-and-plan) |
| Each 問題 format gets the stem it requires | `promptAndContext` (§9), including the four orthography cases | `test/server/assemble-question.test.ts` (three of four cases) |
| An untested type is absent from the radar, never plotted at zero | only tested types are passed to `TypeChart.vue` | `test/app/type-accuracy.test.ts` |
| Spend is bounded by something durable | atomic `consumeBudget()` upsert, per-IP throttle underneath | not covered; both branches are named in TODO.md |

Two gaps worth closing **here** before the port rather than rediscovering there: `prepare.post.ts` projects at three separate call sites and only the projection function itself is tested, so a fourth response path that forgot it would ship answers with the suite green; and neither `consumeBudget()` branch in `analysis.post.ts` has a test, which is the whole cost guarantee.

### 14.6 Do not port

- **The admin auth path.** One shared `ADMIN_PASSWORD`, an HMAC session cookie, an in-process login throttle. Right for a single-maintainer demo, wrong for an app with real accounts. Bayana gates on `UserProfile.role = ADMIN`.
- **The `db push` pipeline.** `prisma db push --accept-data-loss` plus re-seed on every boot (ARCHITECTURE, README). It is correct here only because every table is reproducible or disposable.
- **The single-replica assumption.** Both the in-memory throttle and the at-boot seed depend on it.
- **The known issues in [TODO.md](TODO.md#known-issues).** The display-only timer, the `{ analysis: string }` type that can be null, the pre-hydration quota flash, the possible double-advance on Enter. Since the port is Nuxt to Nuxt, a fix made here travels; anything left unfixed travels too, so decide each one deliberately rather than copying it forward by default.

---

## 15. Product Roadmap

All versions target **N3** only. N1–N5 are unlocked with V4, once N3 is stable.

Each of V1–V3 is available as a **standalone practice mode**; V4 combines all sections into a single timed real-exam experience.

| Version | Focus | Key additions |
|---------|-------|---------------|
| **Demo** | Recruiter demo | 5 vocab types · mixed vocab session (8-6-11-5-5, 35 q) · 30-min timer · wrong-answer review queue · per-type SVG radar chart · directional quiz transitions · AI results analysis · `/admin` audit · HMAC admin auth |
| **V1** | Reading section | JLPT reading comprehension passages + questions |
| **V2** | Grammar section | JLPT grammar / language-knowledge questions |
| **V3** | Listening section | JLPT listening questions (audio-based) |
| **V4** | Real exam mode | All sections in sequence, per-section timers, single submission · N1–N5 unlock · re-enable on-demand question generation |

### Version detail

**Demo (current)**
- Five selectable vocab question types: `reading` (漢字読み), `orthography` (表記), `contextual` (文脈規定), `synonym` (言い換え類義), `usage` (用法)
- Mixed `vocab` session: 35 questions in exam order (8-6-11-5-5 distribution), 30-minute countdown timer
- Pre-seeded pool of 496 (100 per type, except orthography at 96); each single-type session picks 10 at random; seeds in `prisma/seed-data/questions-n3.json`
- Japanese-language answer choices; server-side assembly and answer validation
- **Wrong-answer review queue**: Pinia options store + localStorage (`kalima_review_v1`); `addFails` upserts on any session, `removeCorrects` prunes on review sessions; `dequeue` returns up to 10 oldest-first
- **Review session mode** (`SessionMode = 'review'`): sends `reviewItems: [{ wordId, type }]` to `POST /api/session/prepare`; server validates types, deduplicates, queries by exact `(wordId, type)` pairs via Prisma `OR`, no timer
- **Per-type accuracy radar**: hand-rolled SVG pentagon/triangle/quadrilateral (N-vertex, `computed(() => entries.length)`); only tested types are passed — "not tested" is structurally absent, not visually zero
- **Directional quiz transitions**: `<Transition name="quiz-forward|quiz-backward" mode="out-in">`; direction ref toggled by `goNext()` / `goBack()` before index update; scoped keyframes respect `prefers-reduced-motion`
- Level: N3; no user accounts; **homepage is intentionally public** — designed for tech recruiters
- Results page: score, time, per-question breakdown, `whyWrong` for wrong answers, staggered `slide-up` animations on result items (`--i` CSS custom property), AI performance analysis
- Admin: `/admin` lists all seed questions with S–F review system (majority vote, bulk delete, unranked protection); HMAC session token, constant-time compare, brute-force throttle on login

**V1 — Reading section**
- JLPT-style reading comprehension passages
- New `Passage` data model; new session type or mixed session
- Question types: main idea, detail extraction, inference
- AI generates or curates passages appropriate for N3

**V2 — Grammar section**
- JLPT grammar / language-knowledge question types (particles, conjugation, sentence structure)
- New data model for grammar items; separate question assembly path

**V3 — Listening section**
- Audio-based questions matching JLPT listening format
- Audio delivery via CDN or streaming; in-page player UI
- AI-generated or curated listening scripts

**V4 — Real exam mode**
- Presents all sections (vocab → reading → grammar → listening) in sequence in a single session
- Per-section timers matching actual JLPT time allocation; no early exit between sections
- Single combined submission at the end of the full exam
- Combined score, section breakdowns, and AI performance analysis across all sections
- Re-enable on-demand AI question generation once all sections are fully seeded
- After V4 ships with stable N3: unlock N1, N2, N4, N5 (no schema changes — word list routing and UI gating only)

---

## 16. Revision History

| Date       | Author | Summary                                                                           |
|------------|--------|-----------------------------------------------------------------------------------|
| 2026-06-06 | chairulakmal  | Initial draft                                                                     |
| 2026-06-06 | chairulakmal  | Replace per-question `/answer` with batch `/submit`; answers collected client-side |
| 2026-06-06 | chairulakmal  | Admin: paginate list (25/page); add `GET /admin/questions/:id` with word lookup   |
| 2026-06-06 | chairulakmal  | Results page: surface `whyWrong` and user's wrong choice text for incorrect answers |
| 2026-06-06 | chairulakmal  | Add §13 Product Roadmap                                                            |
| 2026-06-06 | chairulakmal  | Expand roadmap: V3 grammar + V4 listening + V5 real exam; N1–N5 unlock after V5   |
| 2026-06-06 | chairulakmal  | Add `ExamQuestion` model (Japanese-language choices); remove translation mode      |
| 2026-06-07 | chairulakmal  | Exam-only mode: remove translation mode and `GeneratedQuestion`. Switch to Anthropic tool use + per-word validation. |
| 2026-06-07 | chairulakmal  | Three selectable vocab types: `reading`, `orthography`, `synonym`. `ExamQuestion` keyed by (`wordId`, `type`). Type picker on start screen. |
| 2026-06-07 | chairulakmal  | Switch to pre-seeded demo model: 60 → 300 questions offline via `scripts/generate-seed.ts`. Rate limit narrowed to analysis only. |
| 2026-06-07 | chairulakmal  | Expand pool to 100/type (300 total). Upgrade analysis to `claude-sonnet-4-6` (comprehensive, 3–5 sentences). Apply `DAILY_API_LIMIT` to analysis. Example sentence per result. |
| 2026-06-07 | chairulakmal  | Add `contextual` (問題3 文脈規定) question type. Add `SessionMode = QuestionType \| 'vocab'` for mixed 30-question vocab sessions (8-6-11-5 distribution). Add `SessionQuestion.type` column for per-question type tracking. Add 30-minute countdown timer (vocab sessions; amber ≤5 min, red ≤2 min). Update `results.get.ts` for per-question (wordId, type) lookup. Update `generate-seed.ts` with contextual prompt and validator. |
| 2026-06-07 | chairulakmal  | Add `usage` (問題5 用法) question type. Expand vocab session to 35 questions (8-6-11-5-5). Seed pool at 496 questions (100 per type, except orthography at 96). Split seed data by JLPT level (`questions-n3.json`); `seed.ts` reads all `questions-n*.json`. Index page redesign: vocab primary card with 問題1–5 sub-cards, Reading/Grammar coming-soon placeholders. BRAND.md overhaul and `main.css` alignment (AMOLED dark theme, spacing scale, tap targets). |
| 2026-06-07 | chairulakmal  | Security hardening (see `SECURITY.md`). Claude API: per-IP throttle on `analysis` (10/hr) + `prepare` (30/10 min); atomic daily budget via `consumeBudget()` (closes TOCTOU race); graceful degrade on Anthropic errors. Admin: `admin_session` cookie now holds an opaque HMAC token instead of the password; constant-time secret comparison (`safeEqual`); brute-force throttle on login (5/15 min). New utils `server/utils/adminAuth.ts`, `server/utils/throttle.ts`. |
| 2026-06-08 | chairulakmal  | Fix Pinia SSR crash (Pinia 2.3.1 + Vue 3.4+ null-prototype `dep` objects in setup stores): convert `session.ts` to options store. Fix Nitro routing conflict (`questions.get.ts` + `questions/` directory): moved to `questions/index.get.ts`. Fix admin page empty-on-refresh: switch from `await useAsyncData` to `useLazyAsyncData` in `ssr: false` pages. Docs updated to reflect Demo state (5 vocab types, admin auth shipped, roadmap renumbered V1–V4). |
| 2026-06-18 | chairulakmal  | Add directional quiz card transitions (`quiz-forward` / `quiz-backward` Vue Transition, scoped keyframes, `prefers-reduced-motion` via global CSS). Add wrong-answer review queue (`useReviewQueueStore`, `useReviewQueue`, `ReviewItem`; Pinia options store with self-managed localStorage). Add review session mode (`SessionMode = 'review'`; `reviewItems` payload; server whitelist validation + dedup). Add per-type accuracy SVG radar chart (`TypeChart.vue`; N-vertex polygon; tested-only entries). Fix `prepare.post.ts`: consistent `continue`-on-missing-word in all assembly loops; `reviewItems[].type` whitelist guard. Docs updated to reflect all Demo additions. |
| 2026-07-19 | chairulakmal  | README rewritten; `ARCHITECTURE.md` added as the decisions-with-file-paths brief; `CLAUDE.md` demoted to an index of invariants and pointers. |
| 2026-07-25 | chairulakmal  | Kalima superseded by Bayana: no new feature work lands here. Deployment stays live and public; the roadmap is retained as a porting reference. See `TODO.md`. |
| 2026-08-06 | chairulakmal  | Quiz and results pages split into components, composables and pure helpers. Vitest suite over server-side assembly and `app/utils/`; `tsconfig.test.json` alongside `nuxi typecheck`; GitHub Actions CI running lint, both typechecks, tests and build. |
| 2026-08-06 | chairulakmal  | Doc audit against the code. Superseded status recorded in the header and abstract. Removed the stale "per-IP rate limiting" non-goal, which §5 and §8 already contradicted. Rewrote §9 to match `assembleQuestion.ts` (prompt/context split, four orthography cases, `usage` branch). Added `TypeEntry` and `QuestionResult.meaning` to §4.1 and corrected the `context` annotation. Documented the six previously undocumented admin endpoints (§5.5 to §5.12). Added §11 Testing and CI; renumbered former §11 to §14 as §12 to §15. Corrected the seed filename in §6.1, noted that `scripts/` and `questions/` are gitignored, and recorded `passages-n3.json` as committed but unloaded. |
| 2026-08-06 | chairulakmal  | Added §14 Port Surface, written for the agent doing the Bayana port: per-module move / re-decide / leave verdicts, the measured shape of all three committed artifacts, the wordId crosswalk and its 67-collision ambiguity, the invariant-to-test map, and an explicit do-not-port list. Renumbered Product Roadmap to §15 and Revision History to §16. `ARCHITECTURE.md` gained a "Ports as" line per decision. |
