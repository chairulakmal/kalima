import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { assembleQuestion, toClientQuestion } from '../../utils/assembleQuestion'
import { shuffle } from '../../utils/shuffle'
import { throttle, clientKey } from '../../utils/throttle'
import type { Word, Level, QuestionType, SessionMode } from '~~/app/types/index'

const QUESTION_COUNT = 10
const SEED_POOL_SIZE = 100

// Distribution for the full vocabulary section mock (問題1–5), matching real N3 counts.
const VOCAB_DISTRIBUTION: { type: QuestionType; count: number }[] = [
  { type: 'reading',     count: 8  },
  { type: 'orthography', count: 6  },
  { type: 'contextual',  count: 11 },
  { type: 'synonym',     count: 5  },
  { type: 'usage',       count: 5  },
]

export default defineEventHandler(async (event) => {
  // Bound session creation per IP (30 / 10 min) — prevents anonymous flooding of
  // Session/SessionQuestion rows. No Anthropic spend here, but it caps DB writes.
  const gate = throttle(clientKey(event, 'prepare'), 30, 10 * 60_000)
  if (!gate.allowed) {
    throw createError({ statusCode: 429, message: 'Too many requests. Try again later.' })
  }

  const body = await readBody<{ level?: string; type?: string }>(event)
  const level = body?.level as Level
  const mode = normalizeMode(body?.type)

  const validLevels: Level[] = ['N1', 'N2', 'N3', 'N4', 'N5']
  if (!validLevels.includes(level)) {
    throw createError({ statusCode: 400, message: 'Invalid level' })
  }

  const allWords: Word[] = JSON.parse(
    readFileSync(join(process.cwd(), 'words', `${level.toLowerCase()}.json`), 'utf-8'),
  )
  const wordMap = new Map<string, Word>(allWords.map(w => [w.id, w]))

  if (mode === 'vocab') {
    return prepareVocabSession(level, wordMap)
  }
  return prepareSingleTypeSession(level, mode as QuestionType, wordMap)
})

// ── Single-type session (10 questions of one type) ───────────────────────────

async function prepareSingleTypeSession(level: Level, type: QuestionType, wordMap: Map<string, Word>) {
  const pool = await prisma.examQuestion.findMany({
    where: { type, model: 'seed' },
    take: SEED_POOL_SIZE,
  })

  if (pool.length === 0) {
    throw createError({ statusCode: 503, message: 'Seed questions not loaded. Run db:seed first.' })
  }

  const sampled = shuffle(pool).slice(0, QUESTION_COUNT)
  const session = await prisma.session.create({ data: { level, type } })

  const assembled = sampled.map((examQ, order) => {
    const word = wordMap.get(examQ.wordId)
    if (!word) throw new Error(`Word ${examQ.wordId} not found in word list`)

    const sqId = crypto.randomUUID()
    const question = assembleQuestion(word, examQ as AssembleInput, type, sqId)
    const correctChoice = question.choices.find(c => c.isCorrect)!
    return { question, sqId, correctChoiceId: correctChoice.id, order }
  })

  await prisma.sessionQuestion.createMany({
    data: assembled.map(({ sqId, question, correctChoiceId, order }) => ({
      id: sqId,
      sessionId: session.id,
      wordId: question.wordId,
      type,
      correctChoiceId,
      choicesJson: question.choices as unknown as Prisma.InputJsonValue,
      explanation: question.explanation,
      order,
    })),
  })

  return {
    sessionId: session.id,
    questions: assembled.map(({ question }) => toClientQuestion(question)),
  }
}

// ── Full vocabulary section (8-6-11-5 across 4 types) ───────────────────────

async function prepareVocabSession(level: Level, wordMap: Map<string, Word>) {
  const session = await prisma.session.create({ data: { level, type: 'vocab' } })

  let globalOrder = 0
  const allAssembled: {
    question: ReturnType<typeof assembleQuestion>
    sqId: string
    correctChoiceId: string
    order: number
    qType: QuestionType
  }[] = []

  for (const { type: qType, count } of VOCAB_DISTRIBUTION) {
    const pool = await prisma.examQuestion.findMany({
      where: { type: qType, model: 'seed' },
      take: SEED_POOL_SIZE,
    })

    if (pool.length === 0) {
      throw createError({ statusCode: 503, message: `No seed questions for type "${qType}". Run db:seed first.` })
    }

    const sampled = shuffle(pool).slice(0, count)

    for (const examQ of sampled) {
      const word = wordMap.get(examQ.wordId)
      if (!word) continue

      const sqId = crypto.randomUUID()
      const question = assembleQuestion(word, examQ as AssembleInput, qType, sqId)
      const correctChoice = question.choices.find(c => c.isCorrect)!
      allAssembled.push({ question, sqId, correctChoiceId: correctChoice.id, order: globalOrder++, qType })
    }
  }

  await prisma.sessionQuestion.createMany({
    data: allAssembled.map(({ sqId, question, correctChoiceId, order, qType }) => ({
      id: sqId,
      sessionId: session.id,
      wordId: question.wordId,
      type: qType,
      correctChoiceId,
      choicesJson: question.choices as unknown as Prisma.InputJsonValue,
      explanation: question.explanation,
      order,
    })),
  })

  return {
    sessionId: session.id,
    questions: allAssembled.map(({ question }) => toClientQuestion(question)),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Note: prompts live in scripts/generate-seed.ts. This route never calls the AI.
function normalizeMode(t?: string): SessionMode {
  const valid: SessionMode[] = ['reading', 'orthography', 'contextual', 'synonym', 'usage', 'vocab']
  return valid.includes(t as SessionMode) ? (t as SessionMode) : 'synonym'
}

interface AssembleInput {
  correctAnswer: string
  distractors: unknown
  explanation: string
}
