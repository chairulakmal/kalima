import { describe, expect, it } from 'vitest'
import { buildTypeAccuracy } from '../../app/utils/typeAccuracy'
import { questionTypeLabel } from '../../app/utils/questionTypes'
import type { QuestionResult, QuestionType } from '../../app/types/index'

function result(type: QuestionType, correct: boolean): QuestionResult {
  return {
    questionId: `q-${type}-${String(correct)}`,
    wordId: 'w-1',
    type,
    prompt: '階段',
    reading: 'かいだん',
    correctAnswer: '階段',
    userChoiceId: 'c-1',
    correct,
    explanation: '',
  }
}

describe('buildTypeAccuracy', () => {
  it('scores each tested type as correct over total', () => {
    const entries = buildTypeAccuracy([
      result('reading', true),
      result('reading', false),
      result('usage', true),
    ])

    expect(entries).toEqual([
      { type: 'reading', label: '読み', correct: 1, total: 2, pct: 0.5 },
      { type: 'usage',   label: '用法', correct: 1, total: 1, pct: 1 },
    ])
  })

  // A type the session never asked about must be absent from the radar. Plotting it
  // at zero would draw a collapsed polygon that reads as total failure.
  it('omits untested types rather than scoring them zero', () => {
    const entries = buildTypeAccuracy([result('reading', true), result('usage', true)])

    expect(entries?.map(e => e.type)).toEqual(['reading', 'usage'])
  })

  it('orders entries by the exam sequence, not by first appearance', () => {
    const entries = buildTypeAccuracy([
      result('usage', true),
      result('contextual', true),
      result('reading', true),
    ])

    expect(entries?.map(e => e.type)).toEqual(['reading', 'contextual', 'usage'])
  })

  // One vertex is not a shape, so a single-type drill gets no radar at all.
  it('returns null when fewer than two types were tested', () => {
    expect(buildTypeAccuracy([result('reading', true), result('reading', false)])).toBeNull()
    expect(buildTypeAccuracy([])).toBeNull()
  })

  it('counts an unanswered question as incorrect', () => {
    const unanswered: QuestionResult = { ...result('usage', false), correct: null }
    const entries = buildTypeAccuracy([result('reading', true), unanswered])

    expect(entries?.find(e => e.type === 'usage')).toMatchObject({ correct: 0, total: 1 })
  })
})

describe('questionTypeLabel', () => {
  it('labels each question type with its JLPT section heading', () => {
    expect(questionTypeLabel('orthography')).toBe('表記')
    expect(questionTypeLabel('vocab')).toBe('文字・語彙')
  })

  it('falls back to the caller-supplied string for unknown types', () => {
    expect(questionTypeLabel('listening', '語彙')).toBe('語彙')
    expect(questionTypeLabel('listening')).toBe('listening')
  })
})
