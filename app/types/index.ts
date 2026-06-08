export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

// The JLPT vocabulary question type a single question belongs to.
//   reading     — 問題1 漢字読み: pick the correct kana reading of the underlined kanji word
//   orthography — 問題2 表記: pick the correct kanji for the underlined hiragana word
//   contextual  — 問題3 文脈規定: pick the word that best fills the blank in the sentence
//   synonym     — 問題4 言い換え類義: pick the closest synonym, substitutable in context
//   usage       — 問題5 用法: pick the sentence that uses the word correctly
export type QuestionType = 'reading' | 'orthography' | 'contextual' | 'synonym' | 'usage'

export const QUESTION_TYPES: QuestionType[] = ['reading', 'orthography', 'contextual', 'synonym', 'usage']

// Session-level mode: either a single question type or the mixed full-vocab section.
//   vocab — 35-question mixed session: 8 reading + 6 orthography + 11 contextual + 5 synonym + 5 usage
export type SessionMode = QuestionType | 'vocab'

// ── Source data ──────────────────────────────────────────────────────────────

export interface Word {
  id: string
  guid: string
  expression: string
  reading: string
  meaning: string
  level: Level
  tags: string[]
  exampleSentence?: {
    japanese: string
    reading: string
    english: string
  }
}

// ── AI-generated artefacts ───────────────────────────────────────────────────

export interface ExamDistractor {
  text: string
  whyWrong?: string
}

// ── Session types ────────────────────────────────────────────────────────────

export interface Choice {
  id: string
  text: string
  isCorrect: boolean
}

export interface ClientChoice {
  id: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  wordId: string
  prompt: string
  context?: string
  correctAnswer: string
  choices: Choice[]
  explanation: string
}

export interface ClientQuestion {
  id: string
  type: QuestionType
  wordId: string
  prompt: string
  context?: string
  choices: ClientChoice[]
}

export interface Answer {
  questionId: string
  choiceId: string
  isCorrect: boolean
  timeSpentMs: number
}

export interface TestSession {
  id: string
  level: Level
  questionCount: number
  questions: Question[]
  answers: Answer[]
  startedAt: number
  completedAt?: number
}

// ── Results types ────────────────────────────────────────────────────────────

export interface QuestionResult {
  questionId: string
  wordId: string
  type: QuestionType
  prompt: string
  reading: string
  correctAnswer: string
  correctAnswerReading?: string
  userChoiceId: string | null
  userChoiceText?: string
  correct: boolean | null
  explanation: string
  whyWrong?: string
  exampleSentence?: { japanese: string; reading: string; english: string }
}

export interface SessionStats {
  score: number
  totalQuestions: number
  wrongWords: string[]
  weakTags: string[]
  avgTimePerQuestion: number
}
