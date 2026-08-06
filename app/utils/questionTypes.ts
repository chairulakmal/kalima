// The 問題1-5 headings as they are printed on the real JLPT paper, plus the two
// session-level modes. Both the quiz and results pages label questions from this
// one map; they used to keep a copy each.
const TYPE_LABELS: Record<string, string> = {
  reading:     '漢字読み',
  orthography: '表記',
  contextual:  '文脈規定',
  synonym:     '言い換え類義',
  usage:       '用法',
  vocab:       '文字・語彙',
  review:      '復習',
}

// `fallback` differs by caller: page titles echo the raw mode, question labels
// degrade to the generic 語彙.
export function questionTypeLabel(type: string, fallback: string = type): string {
  return TYPE_LABELS[type] ?? fallback
}
