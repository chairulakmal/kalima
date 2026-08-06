import { describe, expect, it } from 'vitest'
import { assembleQuestion, toClientQuestion } from '../../server/utils/assembleQuestion'
import { distractorWhyWrong, kaidan, noSentence, orthographyExam } from '../fixtures'

// The claim these tests defend: during a quiz the browser can render the question
// but cannot know the answer. `toClientQuestion` is the only projection a live
// session sends, so every leak has to pass through here. Grading reads
// SessionQuestion.correctChoiceId server-side instead.
describe('toClientQuestion', () => {
  const question = assembleQuestion(kaidan, orthographyExam, 'orthography', 'sq-1')
  const client = toClientQuestion(question)

  it('drops every field that identifies the correct choice', () => {
    expect(client).not.toHaveProperty('correctAnswer')
    expect(client).not.toHaveProperty('explanation')
    expect(Object.keys(client).sort()).toEqual(['choices', 'context', 'id', 'prompt', 'type', 'wordId'])
  })

  it('exposes only id and text on each choice', () => {
    for (const choice of client.choices) {
      expect(Object.keys(choice).sort()).toEqual(['id', 'text'])
    }
  })

  // The four names are the invariant as CLAUDE.md states it, checked as text on the
  // wire rather than as properties, so a leak nested anywhere still trips this.
  it('serialises without any of the answer-bearing keys', () => {
    const wire = JSON.stringify(client)

    expect(wire).not.toContain('isCorrect')
    expect(wire).not.toContain('correctAnswer')
    expect(wire).not.toContain('explanation')
    expect(wire).not.toContain('whyWrong')
    expect(wire).not.toContain(orthographyExam.explanation)
    expect(wire).not.toContain(distractorWhyWrong)
  })

  // The correct answer's text is necessarily on screen: it is one of the four
  // choices the student picks between. What never ships is which one it is.
  it('keeps all four choice texts, the correct one included', () => {
    const texts = client.choices.map(c => c.text)

    expect(texts).toHaveLength(4)
    expect(texts).toContain(orthographyExam.correctAnswer)
  })

  it('preserves the shuffled choice order and ids', () => {
    expect(client.choices.map(c => c.id)).toEqual(question.choices.map(c => c.id))
    expect(client.choices.map(c => c.text)).toEqual(question.choices.map(c => c.text))
  })

  it('omits context rather than sending it as undefined', () => {
    const bare = toClientQuestion(assembleQuestion(noSentence, orthographyExam, 'orthography', 'sq-2'))

    expect('context' in bare).toBe(false)
  })
})
