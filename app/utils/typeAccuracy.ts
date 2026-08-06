import type { QuestionResult, QuestionType, TypeEntry } from '~/types/index'

const CHART_TYPES: { type: QuestionType; label: string }[] = [
  { type: 'reading',     label: '読み' },
  { type: 'orthography', label: '表記' },
  { type: 'contextual',  label: '文脈' },
  { type: 'synonym',     label: '類義' },
  { type: 'usage',       label: '用法' },
]

// Returns null when the radar should not be drawn at all: a single-type session
// has nothing to compare, and a one-vertex polygon is not a shape.
export function buildTypeAccuracy(results: QuestionResult[]): TypeEntry[] | null {
  const grouped = new Map<QuestionType, { correct: number; total: number }>()
  for (const r of results) {
    const e = grouped.get(r.type) ?? { correct: 0, total: 0 }
    e.total++
    if (r.correct) e.correct++
    grouped.set(r.type, e)
  }

  // Untested types are dropped rather than scored zero, so absence cannot read as failure.
  const entries: TypeEntry[] = []
  for (const { type, label } of CHART_TYPES) {
    const e = grouped.get(type)
    if (!e) continue
    entries.push({ type, label, correct: e.correct, total: e.total, pct: e.correct / e.total })
  }

  return entries.length >= 2 ? entries : null
}
