/**
 * Prisma seed script.
 * Upserts the 60 pre-generated seed questions into ExamQuestion with model='seed'.
 * Run via: npx prisma db seed  (or: npm run db:seed)
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

interface SeedRow {
  wordId: string
  type: string
  correctAnswer: string
  correctReading: string | null
  distractors: unknown
  explanation: string
}

async function main() {
  const seedDir = join(__dirname, 'seed-data')
  const files = readdirSync(seedDir).filter(f => /^questions-n\d+\.json$/.test(f)).sort()
  const rows: SeedRow[] = files.flatMap(f => JSON.parse(readFileSync(join(seedDir, f), 'utf-8')))
  console.log(`Reading from: ${files.join(', ')} (${rows.length} total rows)`)

  let upserted = 0
  for (const row of rows) {
    await prisma.examQuestion.upsert({
      where: { wordId_type: { wordId: row.wordId, type: row.type } },
      update: {
        correctAnswer: row.correctAnswer,
        correctReading: row.correctReading,
        distractors: row.distractors as never,
        explanation: row.explanation,
        model: 'seed',
      },
      create: {
        wordId: row.wordId,
        type: row.type,
        correctAnswer: row.correctAnswer,
        correctReading: row.correctReading,
        distractors: row.distractors as never,
        explanation: row.explanation,
        model: 'seed',
      },
    })
    upserted++
  }

  console.log(`Seeded ${upserted} exam questions.`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
