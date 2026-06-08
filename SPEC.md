# Kalima — Technical Design Specification

| Field        | Value                                      |
|--------------|--------------------------------------------|
| **Status**   | Draft                                      |
| **Author**   | chairulakmal                                      |
| **Created**  | 2026-06-06                                 |
| **Updated**  | 2026-06-07                                 |
| **Reviewers**| —                                          |

---

## Abstract

Kalima is a full-stack JLPT mock exam application built on Nuxt 4. The long-term goal
is a complete exam experience covering all four JLPT sections — vocabulary, reading,
grammar, and listening — with AI-generated questions in authentic exam format, timed
sections, and a combined submission that mirrors the real exam.

The current build is a **recruiter-ready demo** covering all five N3 vocabulary question
types: 漢字読み (reading), 表記 (orthography), 文脈規定 (contextual), 言い換え類義 (synonym), and 用法 (usage).
Questions are pre-generated offline and committed as seed data. Users can practice each
type individually (10 questions) or take the full vocabulary section in exam order under
a 30-minute countdown timer (35 questions, 8-6-11-5-5 distribution). Answer validation is
strictly server-side. After session completion, a Sonnet-powered performance analysis is
generated on demand. The demo homepage is intentionally public and unauthenticated —
designed to be tried immediately by tech recruiters. All V1+ features will be deployed
behind authentication.

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
   - 5.5 [GET /api/admin/questions](#55-get-apiadminquestions)
   - 5.6 [GET /api/admin/questions/:id](#56-get-apiadminquestionsid)
6. [AI Integration](#6-ai-integration)
   - 6.1 [Distractor Generation](#61-seed-question-generation-offline-committed)
   - 6.2 [Session Analysis](#62-session-analysis)
7. [Client Cache](#7-client-cache)
8. [Rate Limiting](#8-rate-limiting)
9. [Question Assembly](#9-question-assembly)
10. [Security Model](#10-security-model)
11. [Alternatives Considered](#11-alternatives-considered)
12. [Open Questions](#12-open-questions)
13. [Product Roadmap](#13-product-roadmap)
14. [Revision History](#14-revision-history)

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

- **On-demand AI question generation during a session.** Questions are pre-seeded; `scripts/generate-seed.ts` is the only path to new questions. Re-enabling live generation is deferred until all exam sections are fully seeded (V5).
- **On-demand AI beyond results analysis.** The only live Anthropic call is `POST /api/session/analysis`. This remains the sole on-demand AI call indefinitely.
- **Authentication on the demo homepage.** The `/` quiz is intentionally public. V1+ features will be gated.
- **N1, N2, N4, N5 level support.** Word lists for all levels exist at `/words/`; only N3 is active. Enabling additional levels requires no schema changes.
- User accounts or cross-session progress tracking.
- Per-user or per-IP rate limiting.
- Real-time collaboration or multiplayer modes.

---

## 3. System Overview

```
Browser
│
├─ index.vue        Mode picker. User selects a SessionMode (single type or full vocab)
│                   → navigates to /loading?level=N3&type={mode}.
│
├─ loading.vue      Calls POST /api/session/prepare.
│                   Stores { sessionId, questions, type } in Pinia + localStorage.
│                   Navigates to /quiz on success.
│
├─ quiz.vue         Displays one ClientQuestion at a time.
│                   Answers collected locally — no server calls per question.
│                   For vocab sessions: 30-minute countdown timer with colour shifts
│                   at ≤5 min (amber) and ≤2 min (red). No auto-submit.
│                   Per-question type label shown in header for vocab sessions.
│                   On "Submit Test" (last question): POST /api/session/submit
│                   with all answers at once. Navigates to /results on success.
│                   No correctness feedback shown during the quiz.
│
└─ results.vue      GET /api/session/results → score, time, breakdown + explanations.
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
├─ GET /api/admin/questions
│   Return paginated ExamQuestion rows (25/page) with rank filter.
│
└─ GET /api/admin/questions/:id
    Return full detail for one row, including word lookup + reviews.

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

// Session-level mode: either a single question type or the mixed full-vocab section.
//   vocab — 35-question mixed session: 8 reading + 6 orthography + 11 contextual + 5 synonym + 5 usage
export type SessionMode = QuestionType | 'vocab'

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
  prompt: string             // varies by type (see §9)
  context?: string           // reserved; unused in current types
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
  questionCount: number      // 10 (single-type) or 30 (vocab)
  questions: Question[]
  answers: Answer[]
  startedAt: number
  completedAt?: number
}

// ── Results types ────────────────────────────────────────────────────────────

export interface QuestionResult {
  questionId: string
  wordId: string
  type: QuestionType         // per-question type; required for mixed vocab sessions
  prompt: string
  reading: string
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
  totalQuestions: number     // 10 or 30
  wrongWords: string[]
  weakTags: string[]
  avgTimePerQuestion: number // milliseconds
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
  type           String               // 'reading' | 'orthography' | 'contextual' | 'synonym'
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
All error responses use the shape `{ error: string, code: string }`.

---

### 5.1 POST /api/session/prepare

Prepares a session. Called once from `loading.vue`.

**Request body**
```typescript
{ level: Level; type: SessionMode }
```

**Response — 200 OK**
```typescript
{
  sessionId: string
  questions: ClientQuestion[]  // 10 items for single-type; 30 for 'vocab'
}
```

**Error responses**

| Status | `code`           | Condition                                            |
|--------|------------------|------------------------------------------------------|
| 400    | `INVALID_REQUEST`| `level` or `type` invalid                           |
| 503    | `NO_SEED_DATA`   | Seed pool empty for a required type                 |
| 500    | `PREPARE_FAILED` | Unexpected server error                              |

**Server-side flow — single-type session**

1. Validate `level` and `type`.
2. Query `ExamQuestion WHERE model='seed' AND type=requestedType` (pool up to 100).
3. If pool is empty, return HTTP 503.
4. Shuffle pool; take 10.
5. Load word metadata from `words/${level}.json`.
6. Assemble 10 `Question` objects; shuffle choices.
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

**Response — 200 OK**
```typescript
{ ok: true }
```

**Error responses**

| Status | `code`           | Condition                                      |
|--------|------------------|------------------------------------------------|
| 400    | `INVALID_REQUEST`| `sessionId` absent or `answers` not an array   |
| 500    | `SUBMIT_FAILED`  | Unexpected server error                        |

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

**Response — 200 OK**
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

| Status | `code`               | Condition                              |
|--------|----------------------|----------------------------------------|
| 400    | `MISSING_SESSION_ID` | `sessionId` query param absent         |
| 404    | `SESSION_NOT_FOUND`  | `sessionId` does not exist             |
| 422    | `SESSION_INCOMPLETE` | One or more questions are unanswered   |
| 500    | `RESULTS_FAILED`     | Unexpected server error                |

**Server-side flow**

1. Load `Session` with all `SessionQuestion` rows.
2. Fetch `ExamQuestion` rows for all (wordId, type) pairs in one query using `OR`:
   ```typescript
   OR: session.questions.map(sq => ({ wordId: sq.wordId, type: sq.type }))
   ```
   Key by `${wordId}::${type}` for O(1) lookup.
3. Load word metadata from the word-list JSON for all wordIds.
4. For each `SessionQuestion`, reconstruct the prompt by type:
   - `reading` / `orthography`: `word.expression` (underlined in the UI)
   - `synonym`: `word.expression`
   - `contextual`: replace the target word in `exampleSentence.japanese` with `（　　）`
5. Build `QuestionResult` per question. For incorrect answers, match the chosen distractor
   text against `ExamQuestion.distractors` to recover `whyWrong`.
6. Suppress `exampleSentence` from the result for `contextual` questions (it is already the prompt).

---

### 5.4 POST /api/session/analysis

Generates an AI performance analysis using `claude-sonnet-4-6`. Called once from `results.vue`.
**Subject to the shared `DAILY_API_LIMIT` counter.**

**Request body**
```typescript
{ sessionId: string }
```

**Response — 200 OK**
```typescript
{
  analysis: string | null  // null when daily limit is reached; UI silently omits the panel
}
```

**Error responses**

| Status | `code`               | Condition                              |
|--------|----------------------|----------------------------------------|
| 400    | `MISSING_SESSION_ID` | `sessionId` body field absent          |
| 404    | `SESSION_NOT_FOUND`  | `sessionId` does not exist             |
| 422    | `SESSION_INCOMPLETE` | One or more questions are unanswered   |
| 500    | `ANALYSIS_FAILED`    | Unexpected server error                |

**Server-side flow**

1. If `Session.analysis` is already populated, return the cached value immediately.
2. Check `canGenerate()` — if the daily limit is exhausted, return `{ analysis: null }`.
3. Call `incrementCount()`.
4. Load session, questions, and word metadata.
5. Call `claude-sonnet-4-6` (see §6.2).
6. Persist the returned paragraph to `Session.analysis`.
7. Return `{ analysis }`.

---

### 5.5 GET /api/admin/questions

Returns a paginated list of `ExamQuestion` rows for audit. Requires a valid `admin_session` cookie (see §10).

**Query parameters**

| Parameter | Type   | Default | Description                        |
|-----------|--------|---------|------------------------------------|
| `page`    | number | 1       | 1-indexed page number              |
| `rank`    | string | —       | Filter by effective rank (S–F)     |

Page size is fixed at 25 rows.

**Response — 200 OK**
```typescript
{
  questions: { id, wordId, type, model, explanation, version, createdAt, effectiveRank }[]
  total: number
  page: number
  pageSize: number      // always 25
  totalPages: number
}
```

---

### 5.6 GET /api/admin/questions/:id

Returns full detail for a single `ExamQuestion`, including word lookup and reviews.

**Response — 200 OK**
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

## 6. AI Integration

**Question generation** (offline only, `scripts/generate-seed.ts`) uses `claude-sonnet-4-6`.
**Session analysis** (`POST /api/session/analysis`) uses `claude-sonnet-4-6` and is the only live Anthropic call. On-demand question generation is permanently disabled until V5 (all exam sections seeded).

> **Question format reference:** `questions/README.md` documents universal AI generation rules and the live output contract. Per-type prompt rules (vocab types) are in `questions/vocab.md`.

---

### 6.1 Seed Question Generation (offline, committed)

Questions are **not** generated on demand during a session. `scripts/generate-seed.ts`
is run offline to produce `prisma/seed-data/questions.json`. `prisma/seed.ts` upserts
these rows into `ExamQuestion` with `model='seed'` on each deploy.

**Pool size:** 100 questions per type. Current state: 500 seeded (all five types: reading, orthography, contextual, synonym, usage). Seed file: `prisma/seed-data/questions-n3.json`; `prisma/seed.ts` reads all `questions-n*.json` files to support future JLPT levels.

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

Sonnet is used over Haiku because pattern recognition across 10–30 questions — identifying
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
  type: SessionMode          // 'vocab' | QuestionType
  startedAt: number          // Unix timestamp (ms)
}
```

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

The core function builds the prompt and choices for a given word and question type.

```typescript
// Prompt construction by type
function promptAndContext(word: Word, type: QuestionType) {
  const sentence = word.exampleSentence?.japanese
  if (type === 'reading') {
    return { prompt: word.expression }
  }
  if (type === 'orthography') {
    return { prompt: word.reading }
  }
  if (type === 'contextual') {
    if (sentence) {
      const target = sentence.includes(word.expression) ? word.expression
        : sentence.includes(word.reading)    ? word.reading
        : null
      if (target) return { prompt: sentence.replace(target, '（　　）') }
    }
    return { prompt: `（　　）— ${word.meaning}` }  // fallback
  }
  // synonym
  return { prompt: word.expression }
}
```

For `reading` and `orthography`, the correct answer is ground truth from the word data
and is never AI-generated. For `synonym`, the correct answer is AI-generated and stored
in `ExamQuestion.correctAnswer`. For `contextual`, the correct answer is `word.expression`
(or `word.reading` if the expression doesn't appear in the example sentence).

**Client-safe projection** (applied in `prepare.post.ts` before the response is sent)

```typescript
function toClientQuestion(q: Question): ClientQuestion {
  return {
    id: q.id,
    type: q.type,
    wordId: q.wordId,
    prompt: q.prompt,
    choices: q.choices.map(({ id, text }) => ({ id, text })),
  }
}
```

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

## 11. Alternatives Considered

### 11.1 Client-side question assembly

**Considered:** Assemble questions in the browser after receiving the word list and distractors.

**Rejected:** The client would necessarily receive `isCorrect` flags and `correctAnswer` values,
making it trivial to cheat via DevTools. Server-side assembly and the `toClientQuestion`
projection eliminate this attack surface entirely.

---

### 11.2 Per-word AI calls instead of a single batch call

**Considered:** Issue one Anthropic API call per missing word during session preparation.

**Rejected:** A session with many missing words would require many sequential API calls,
increasing latency and cost. A single batched prompt achieves the same result in one round-trip.

---

### 11.3 Regenerate distractors every session

**Considered:** Generate fresh distractors for every word on every session.

**Rejected:** This would make every session subject to the rate limit and multiply API cost
proportionally with usage. Pre-seeded rows are consistent across sessions for the same word.

---

### 11.4 In-memory rate limit counter

**Considered:** Store the daily request count in a module-level variable.

**Rejected:** The counter would reset on every deployment or server restart. Railway's
deployment model means restarts are frequent. Persisting in PostgreSQL makes the counter
durable across process restarts.

---

### 11.5 Pinia as the sole session cache

**Considered:** Skip localStorage and rely exclusively on Pinia store.

**Rejected:** Pinia store is in-memory. A hard refresh during an active quiz would wipe
the `questions` array, requiring a new `POST /api/session/prepare` call. localStorage
makes refreshes transparent to the user at no additional cost.

---

### 11.6 Storing contextual prompt in ExamQuestion

**Considered:** Pre-compute and store the sentence-with-blank as a `context` field on `ExamQuestion`.

**Rejected:** The blank is always derived from `exampleSentence.japanese` by replacing
`word.expression` or `word.reading`. Computing it at runtime from the word JSON avoids a
schema change to `ExamQuestion` and keeps the prompt consistent if the word data changes.

---

## 12. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should `analysis` calls count against a separate daily budget, or be truly unlimited? | — | **Resolved 2026-06-07:** analysis is rate-limited via the shared `DAILY_API_LIMIT` counter. |
| 2 | The current fallback distractor strategy may produce low-quality choices for some words. Should fallback results be flagged in the DB for later regeneration? | — | Open |
| 3 | `ExamQuestion.version` is stored but never incremented. Define a policy for when regeneration should be triggered (e.g. model upgrade, quality threshold). | — | Open |
| 4 | The admin page is unauthed. Is an obscure URL acceptable long-term, or should a token-based guard be added before any public announcement? | — | **Resolved 2026-06-07:** HMAC token cookie + constant-time compare + brute-force throttle deployed in Demo. See `SECURITY.md`. |

---

## 13. Product Roadmap

All versions target **N3** only. N1–N5 are unlocked after V5 ships and N3 is stable.

Each of V1–V3 is available as a **standalone practice mode**; V4 combines all sections into a single timed real-exam experience.

| Version | Focus | Key additions |
|---------|-------|---------------|
| **Demo** | Recruiter demo | 5 vocab types · mixed vocab session (8-6-11-5-5, 35 q) · 30-min timer · AI results analysis · `/admin` audit · HMAC admin auth |
| **V1** | Reading section | JLPT reading comprehension passages + questions |
| **V2** | Grammar section | JLPT grammar / language-knowledge questions |
| **V3** | Listening section | JLPT listening questions (audio-based) |
| **V4** | Real exam mode | All sections in sequence, per-section timers, single submission · N1–N5 unlock · re-enable on-demand question generation |

### Version detail

**Demo (current)**
- Five selectable vocab question types: `reading` (漢字読み), `orthography` (表記), `contextual` (文脈規定), `synonym` (言い換え類義), `usage` (用法)
- Mixed `vocab` session: 35 questions in exam order (8-6-11-5-5 distribution), 30-minute countdown timer
- 100 pre-seeded questions per type (500 total); each single-type session picks 10 at random; seeds in `prisma/seed-data/questions-n3.json`
- Japanese-language answer choices; server-side assembly and answer validation
- Level: N3; no user accounts; **homepage is intentionally public** — designed for tech recruiters
- Results page: score, time, per-question breakdown, `whyWrong` for wrong answers, AI performance analysis
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

## 14. Revision History

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
| 2026-06-07 | chairulakmal  | Add `usage` (問題5 用法) question type. Expand vocab session to 35 questions (8-6-11-5-5). Seed pool complete at 500 questions (100 × 5 types). Split seed data by JLPT level (`questions-n3.json`); `seed.ts` reads all `questions-n*.json`. Index page redesign: vocab primary card with 問題1–5 sub-cards, Reading/Grammar coming-soon placeholders. BRAND.md overhaul and `main.css` alignment (AMOLED dark theme, spacing scale, tap targets). |
| 2026-06-07 | chairulakmal  | Security hardening (see `SECURITY.md`). Claude API: per-IP throttle on `analysis` (10/hr) + `prepare` (30/10 min); atomic daily budget via `consumeBudget()` (closes TOCTOU race); graceful degrade on Anthropic errors. Admin: `admin_session` cookie now holds an opaque HMAC token instead of the password; constant-time secret comparison (`safeEqual`); brute-force throttle on login (5/15 min). New utils `server/utils/adminAuth.ts`, `server/utils/throttle.ts`. |
| 2026-06-08 | chairulakmal  | Fix Pinia SSR crash (Pinia 2.3.1 + Vue 3.4+ null-prototype `dep` objects in setup stores): convert `session.ts` to options store. Fix Nitro routing conflict (`questions.get.ts` + `questions/` directory): moved to `questions/index.get.ts`. Fix admin page empty-on-refresh: switch from `await useAsyncData` to `useLazyAsyncData` in `ssr: false` pages. Docs updated to reflect Demo state (5 vocab types, admin auth shipped, roadmap renumbered V1–V4). |
