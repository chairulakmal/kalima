import { prisma } from '../../lib/prisma'

export default defineEventHandler(async (event) => {
  const { sessionId, answers } = await readBody<{
    sessionId: string
    answers: { questionId: string; choiceId: string }[]
  }>(event)

  if (!sessionId || !Array.isArray(answers) || answers.length === 0) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const questionIds = answers.map(a => a.questionId)
  const questions = await prisma.sessionQuestion.findMany({
    where: { sessionId, id: { in: questionIds } },
  })

  const answerMap = new Map(answers.map(a => [a.questionId, a.choiceId]))

  await Promise.all(
    questions
      .filter(sq => sq.userChoiceId === null)
      .map(sq => {
        const choiceId = answerMap.get(sq.id) ?? ''
        return prisma.sessionQuestion.update({
          where: { id: sq.id },
          data: { userChoiceId: choiceId, correct: sq.correctChoiceId === choiceId },
        })
      }),
  )

  await prisma.session.update({
    where: { id: sessionId },
    data: { completedAt: new Date() },
  })

  return { ok: true }
})
