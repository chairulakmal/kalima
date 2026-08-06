import type { Word } from '../app/types/index'

// The kanji compound appears verbatim in its example sentence, which is the case
// orthography questions have to defuse: the answer is the kanji itself.
export const kaidan: Word = {
  id: 'w-kaidan',
  guid: 'kaidan-guid',
  expression: '階段',
  reading: 'かいだん',
  meaning: 'stairs',
  level: 'N3',
  tags: [],
  exampleSentence: {
    japanese: '駅の階段を上る。',
    reading: 'えきのかいだんをのぼる。',
    english: 'Go up the stairs at the station.',
  },
}

// A verb whose sentence form is conjugated, so the kanji stem appears without its
// dictionary okurigana.
export const shiraberu: Word = {
  id: 'w-shiraberu',
  guid: 'shiraberu-guid',
  expression: '調べる',
  reading: 'しらべる',
  meaning: 'to look into',
  level: 'N3',
  tags: [],
  exampleSentence: {
    japanese: 'ネットで調べました。',
    reading: 'ネットでしらべました。',
    english: 'I looked it up online.',
  },
}

export const noSentence: Word = {
  id: 'w-yousu',
  guid: 'yousu-guid',
  expression: '様子',
  reading: 'ようす',
  meaning: 'appearance, situation',
  level: 'N3',
  tags: [],
}

// Named so the leakage test can assert on the exact string without indexing into
// the array, which `noUncheckedIndexedAccess` would widen to `string | undefined`.
export const distractorWhyWrong = '「皆」は「みな」で音が違う。'

export const orthographyExam = {
  correctAnswer: '階段',
  distractors: [
    { text: '皆段', whyWrong: distractorWhyWrong },
    { text: '界段' },
    { text: '階談' },
  ],
  explanation: '「かいだん」は「階段」と書く。',
}
