export const RANKS = ['S', 'A', 'B', 'C', 'D', 'F'] as const
export type Rank = (typeof RANKS)[number]

// S, A, B are protected — the effective rank must be changed before deletion is allowed.
// Unranked (null) is also protected; a question must be explicitly rated C/D/F to be deletable.
const PROTECTED = new Set<string>(['S', 'A', 'B'])

// Majority-vote with tie-breaking toward the worst rank.
// Single reviewer → their rank. No reviews → null (unranked).
export function computeRank(reviews: { rank: string }[]): Rank | null {
  if (!reviews.length) return null
  const counts: Partial<Record<Rank, number>> = {}
  for (const r of reviews) {
    const k = r.rank as Rank
    counts[k] = (counts[k] ?? 0) + 1
  }
  const maxCount = Math.max(...(Object.values(counts) as number[]))
  // RANKS is S→F order; filter tied ranks and take the last (worst tied rank).
  const tied = RANKS.filter(r => (counts[r] ?? 0) === maxCount)
  return tied.at(-1)!
}

export function isDeletable(rank: Rank | null): boolean {
  return rank !== null && !PROTECTED.has(rank)
}
