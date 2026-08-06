import { describe, expect, it } from 'vitest'
import { assembleQuestion } from '../../server/utils/assembleQuestion'
import { kaidan, noSentence, orthographyExam, shiraberu } from '../fixtures'

describe('assembleQuestion', () => {
  it('builds one correct choice plus three distractors', () => {
    const question = assembleQuestion(kaidan, orthographyExam, 'orthography', 'sq-1')

    expect(question.choices).toHaveLength(4)
    expect(question.choices.filter(c => c.isCorrect)).toHaveLength(1)
    expect(question.choices.find(c => c.isCorrect)?.text).toBe(orthographyExam.correctAnswer)
  })

  it('caps distractors at three when the stored pool holds more', () => {
    const overfull = {
      ...orthographyExam,
      distractors: [...orthographyExam.distractors, { text: '介段' }, { text: '解段' }],
    }

    expect(assembleQuestion(kaidan, overfull, 'orthography', 'sq-1').choices).toHaveLength(4)
  })

  it('gives every choice a distinct id', () => {
    const { choices } = assembleQuestion(kaidan, orthographyExam, 'orthography', 'sq-1')

    expect(new Set(choices.map(c => c.id)).size).toBe(4)
  })

  // Position is the one tell a shuffle has to remove: a correct answer pinned to a
  // fixed index is guessable without reading the question at all.
  it('does not seat the correct choice at a fixed position', () => {
    const positions = new Set<number>()
    for (let i = 0; i < 100; i++) {
      const { choices } = assembleQuestion(kaidan, orthographyExam, 'orthography', `sq-${i}`)
      positions.add(choices.findIndex(c => c.isCorrect))
    }

    expect(positions.size).toBeGreaterThan(1)
  })
})

// Each JLPT vocabulary type puts the word on screen differently, and 問題2 (orthography)
// carries a trap: the answer is the kanji spelling, so the stem must never show it.
describe('question stems by type', () => {
  describe('orthography', () => {
    it('swaps the kanji for its reading so the sentence cannot give the answer away', () => {
      const { prompt, context } = assembleQuestion(kaidan, orthographyExam, 'orthography', 'sq-1')

      expect(prompt).toBe('かいだん')
      expect(context).toBe('駅のかいだんを上る。')
      expect(context).not.toContain(kaidan.expression)
    })

    it('swaps only the kanji stem when the sentence conjugates the word', () => {
      const { prompt, context } = assembleQuestion(shiraberu, orthographyExam, 'orthography', 'sq-1')

      expect(prompt).toBe('しらべる')
      expect(context).toBe('ネットでしらべました。')
      expect(context).not.toContain('調')
    })

    it('falls back to the bare reading when the word has no example sentence', () => {
      const { prompt, context } = assembleQuestion(noSentence, orthographyExam, 'orthography', 'sq-1')

      expect(prompt).toBe('ようす')
      expect(context).toBeUndefined()
    })
  })

  it('blanks the target word out of the sentence for contextual questions', () => {
    const { prompt, context } = assembleQuestion(kaidan, orthographyExam, 'contextual', 'sq-1')

    expect(prompt).toBe('駅の（　　）を上る。')
    expect(prompt).not.toContain(kaidan.expression)
    expect(context).toBeUndefined()
  })

  it('shows the word alone for usage questions, whose choices are whole sentences', () => {
    const { prompt, context } = assembleQuestion(kaidan, orthographyExam, 'usage', 'sq-1')

    expect(prompt).toBe('階段')
    expect(context).toBeUndefined()
  })

  it('underlines the kanji word inside its sentence for reading and synonym questions', () => {
    for (const type of ['reading', 'synonym'] as const) {
      const { prompt, context } = assembleQuestion(kaidan, orthographyExam, type, 'sq-1')

      expect(prompt).toBe('階段')
      expect(context).toBe(kaidan.exampleSentence?.japanese)
    }
  })
})
