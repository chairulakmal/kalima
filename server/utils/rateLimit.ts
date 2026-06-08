import { prisma } from '../lib/prisma'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
}

export async function canGenerate(): Promise<boolean> {
  const limit = parseInt(process.env.DAILY_API_LIMIT ?? '10', 10)
  const record = await prisma.rateLimit.findUnique({ where: { date: todayKey() } })
  return !record || record.requestCount < limit
}

/**
 * Atomically reserve one unit of the daily Anthropic budget and report whether the
 * reservation was within limit. The upsert+increment executes as a single row-level
 * atomic operation in Postgres, so concurrent callers can never overshoot the cap
 * (closes the check-then-increment TOCTOU race). Callers that get `false` must not
 * call the API; the consumed slot is harmless since the row resets daily.
 */
export async function consumeBudget(): Promise<boolean> {
  const limit = parseInt(process.env.DAILY_API_LIMIT ?? '10', 10)
  const record = await prisma.rateLimit.upsert({
    where: { date: todayKey() },
    update: { requestCount: { increment: 1 } },
    create: { date: todayKey(), requestCount: 1 },
  })
  return record.requestCount <= limit
}
