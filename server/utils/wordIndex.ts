import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Word } from '~~/app/types/index'

const LEVELS = ['n1', 'n2', 'n3', 'n4', 'n5']
let _index: Map<string, Word> | null = null

export function getWordIndex(): Map<string, Word> {
  if (_index) return _index
  _index = new Map()
  for (const level of LEVELS) {
    try {
      const words: Word[] = JSON.parse(
        readFileSync(join(process.cwd(), 'words', `${level}.json`), 'utf-8'),
      )
      for (const word of words) _index.set(word.id, word)
    } catch { /* skip missing level files */ }
  }
  return _index
}
