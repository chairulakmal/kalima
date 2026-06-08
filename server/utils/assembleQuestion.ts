import { shuffle } from './shuffle'
import type { Word, Choice, Question, ClientQuestion, QuestionType } from '~~/app/types/index'

interface StoredExamQuestion {
  correctAnswer: string
  distractors: unknown
  explanation: string
}

interface ExamDistractorData {
  text: string
  whyWrong?: string
}

// What appears on screen for each question type: the underlined token (`prompt`) and the
// sentence it sits in (`context`). The client (QuizCard) underlines `prompt` inside `context`.
function promptAndContext(word: Word, type: QuestionType): { prompt: string; context?: string } {
  const sentence = word.exampleSentence?.japanese

  if (type === 'orthography') {
    // Case 1: kanji expression present literally → replace with reading to hide the answer.
    if (sentence && word.expression && sentence.includes(word.expression)) {
      return { prompt: word.reading, context: sentence.split(word.expression).join(word.reading) }
    }
    // Case 2: word already appears in kana in the Japanese sentence → use as-is (answer not revealed).
    if (sentence && word.reading && sentence.includes(word.reading)) {
      return { prompt: word.reading, context: sentence }
    }
    // Case 3: conjugated/inflected form — show no context rather than an all-kana sentence.
    return { prompt: word.reading }
  }

  if (type === 'contextual') {
    // Replace the target word with （　　） to form the fill-in-the-blank sentence.
    // The prompt IS the sentence; no separate context field needed.
    if (sentence) {
      const target = sentence.includes(word.expression) ? word.expression
        : sentence.includes(word.reading) ? word.reading
        : null
      if (target) return { prompt: sentence.replace(target, '（　　）') }
    }
    return { prompt: `（　　）— ${word.meaning}` }
  }

  if (type === 'usage') {
    // Choices are full sentences; show just the word as the prompt with no context.
    return { prompt: word.expression }
  }

  // synonym & reading: the kanji word is underlined in its sentence.
  return { prompt: word.expression, context: sentence }
}

export function assembleQuestion(
  word: Word,
  examQ: StoredExamQuestion,
  type: QuestionType,
  id: string,
): Question {
  const distractors = (examQ.distractors as ExamDistractorData[]).slice(0, 3)

  const correctChoice: Choice = { id: crypto.randomUUID(), text: examQ.correctAnswer, isCorrect: true }
  const wrongChoices: Choice[] = distractors.map(d => ({
    id: crypto.randomUUID(),
    text: d.text,
    isCorrect: false,
  }))

  const { prompt, context } = promptAndContext(word, type)

  return {
    id,
    type,
    wordId: word.id,
    prompt,
    context,
    correctAnswer: examQ.correctAnswer,
    choices: shuffle([correctChoice, ...wrongChoices]),
    explanation: examQ.explanation,
  }
}

// Server-safe projection: strips isCorrect / correctAnswer / explanation before the
// question is sent to the client during a quiz.
export function toClientQuestion(q: Question): ClientQuestion {
  return {
    id: q.id,
    type: q.type,
    wordId: q.wordId,
    prompt: q.prompt,
    ...(q.context !== undefined && { context: q.context }),
    choices: q.choices.map((c: Choice) => ({ id: c.id, text: c.text })),
  }
}
