import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../lib/prisma'
import type { Word, ExamDistractor, QuestionResult, QuestionType } from '~~/app/types/index'

type StoredChoice = { id: string; text: string; isCorrect: boolean }

export default defineEventHandler(async (event) => {
  const { sessionId } = getQuery(event) as { sessionId?: string }

  if (!sessionId) throw createError({ statusCode: 400, message: 'sessionId required' })

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { questions: { orderBy: { order: 'asc' } } },
  })

  if (!session) throw createError({ statusCode: 404, message: 'Session not found' })

  const allWords: Word[] = JSON.parse(
    readFileSync(join(process.cwd(), 'words', `${session.level.toLowerCase()}.json`), 'utf-8'),
  )
  const wordMap = new Map(allWords.map(w => [w.id, w]))

  const wrongWordIds = new Set(
    session.questions
      .filter(sq => sq.correct === false && sq.userChoiceId)
      .map(sq => sq.wordId),
  )

  // Fetch ExamQuestions by individual (wordId, type) pairs — required for vocab sessions
  // where each question can have a different type.
  const eqs = await prisma.examQuestion.findMany({
    where: {
      OR: session.questions.map(sq => ({
        wordId: sq.wordId,
        type: sq.type || session.type,
      })),
    },
    select: { wordId: true, type: true, distractors: true, correctReading: true },
  })

  const eqKey = (wordId: string, type: string) => `${wordId}::${type}`
  const distractorMap = new Map<string, ExamDistractor[]>()
  const correctReadingMap = new Map<string, string>()

  for (const eq of eqs) {
    const key = eqKey(eq.wordId, eq.type)
    if (wrongWordIds.has(eq.wordId)) {
      distractorMap.set(key, eq.distractors as unknown as ExamDistractor[])
    }
    if (eq.correctReading) correctReadingMap.set(key, eq.correctReading)
  }

  const results: QuestionResult[] = session.questions.map(sq => {
    const choices = sq.choicesJson as StoredChoice[]
    const correctChoice = choices.find(c => c.id === sq.correctChoiceId)
    const word = wordMap.get(sq.wordId)
    const sqType = (sq.type || session.type) as QuestionType
    const key = eqKey(sq.wordId, sqType)

    // Reconstruct the prompt the student saw during the quiz.
    let prompt: string
    if (sqType === 'orthography') {
      prompt = word?.reading ?? sq.wordId
    } else if (sqType === 'contextual') {
      const sentence = word?.exampleSentence?.japanese
      const expr = word?.expression ?? ''
      const rdng = word?.reading ?? ''
      const target = sentence?.includes(expr) ? expr : sentence?.includes(rdng) ? rdng : null
      prompt = sentence && target ? sentence.replace(target, '（　　）') : expr || sq.wordId
    } else {
      prompt = word?.expression ?? sq.wordId
    }

    let userChoiceText: string | undefined
    let whyWrong: string | undefined
    if (sq.correct === false && sq.userChoiceId) {
      userChoiceText = choices.find(c => c.id === sq.userChoiceId)?.text
      if (userChoiceText) {
        whyWrong = distractorMap.get(key)?.find(d => d.text === userChoiceText)?.whyWrong
      }
    }

    return {
      questionId: sq.id,
      wordId: sq.wordId,
      type: sqType,
      prompt,
      reading: word?.reading ?? '',
      meaning: word?.meaning,
      correctAnswer: correctChoice?.text ?? '',
      correctAnswerReading: correctReadingMap.get(key),
      userChoiceId: sq.userChoiceId,
      userChoiceText,
      correct: sq.correct,
      explanation: sq.explanation,
      whyWrong,
      exampleSentence: word?.exampleSentence,
    }
  })

  return {
    sessionId: session.id,
    level: session.level,
    type: session.type,
    score: results.filter(r => r.correct === true).length,
    totalQuestions: results.length,
    startedAt: session.startedAt.getTime(),
    completedAt: (session.completedAt ?? new Date()).getTime(),
    results,
  }
})
