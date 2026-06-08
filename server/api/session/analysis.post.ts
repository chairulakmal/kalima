import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma'
import { consumeBudget } from '../../utils/rateLimit'
import { throttle, clientKey } from '../../utils/throttle'
import type { Word } from '~~/app/types/index'
import type { SessionQuestion } from '@prisma/client'

const MODEL = 'claude-sonnet-4-6'

export default defineEventHandler(async (event) => {
  // Per-IP throttle (10/hour) so no single client can drain the shared daily
  // Anthropic budget before the global cap is even reached. Defence in depth.
  const gate = throttle(clientKey(event, 'analysis'), 10, 60 * 60_000)
  if (!gate.allowed) {
    throw createError({ statusCode: 429, message: 'Too many requests. Try again later.' })
  }

  const { sessionId } = await readBody<{ sessionId?: string }>(event)
  if (!sessionId || typeof sessionId !== 'string') {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { questions: { orderBy: { order: 'asc' } } },
  })

  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })
  if (session.analysis) return { analysis: session.analysis }

  const allWords: Word[] = JSON.parse(
    readFileSync(join(process.cwd(), 'words', `${session.level.toLowerCase()}.json`), 'utf-8'),
  )
  const wordMap = new Map(allWords.map(w => [w.id, w]))

  const correct = session.questions.filter((q: SessionQuestion) => q.correct === true).length
  const total = session.questions.length

  type StoredChoice = { id: string; text: string; isCorrect: boolean }
  const questionLines = session.questions.map((q: SessionQuestion) => {
    const word = wordMap.get(q.wordId)
    const choices = q.choicesJson as StoredChoice[]
    const correctChoice = choices.find(c => c.id === q.correctChoiceId)
    const userChoice = q.userChoiceId ? choices.find(c => c.id === q.userChoiceId) : null
    const expression = word ? `${word.expression} (${word.reading}) — ${word.meaning}` : q.wordId
    if (q.correct) return `✓ ${expression}`
    return `✗ ${expression} | chose "${userChoice?.text ?? '?'}", correct: "${correctChoice?.text ?? '?'}"`
  })

  // Atomically reserve budget; on overrun, silently omit the panel (no API call).
  if (!await consumeBudget()) return { analysis: null }

  try {
    const client = new Anthropic()
    const { content } = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: `A student just completed a JLPT ${session.level} ${session.type} vocabulary quiz.
Score: ${correct}/${total}

Questions:
${questionLines.join('\n')}

Write a comprehensive 3–5 sentence performance analysis. Cover: (1) overall result, (2) any patterns in the mistakes — e.g. similar word forms, reading errors, semantic confusion — and (3) specific study advice tied to the words they missed. Be encouraging and concrete. Reply with plain prose only — no markdown headers, no bullet points, no formatting.`,
        },
      ],
    })

    const block = content.find(b => b.type === 'text')
    const analysis = block && 'text' in block ? (block.text as string) : 'Great effort! Keep practicing.'

    await prisma.session.update({ where: { id: sessionId }, data: { analysis } })

    return { analysis }
  } catch (err) {
    // Never leak upstream error detail to the client; degrade gracefully.
    console.error('[analysis] Anthropic call failed:', err)
    return { analysis: null }
  }
})
