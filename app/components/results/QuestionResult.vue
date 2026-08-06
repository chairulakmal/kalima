<script setup lang="ts">
import type { QuestionResult } from '~/types/index'

const props = defineProps<{
  result: QuestionResult
  number: number
}>()

// For 文脈規定 the prompt is the whole sentence, so a reading line would repeat it.
const showsReading = computed(() =>
  Boolean(props.result.reading)
  && props.result.reading !== props.result.prompt
  && props.result.type !== 'contextual',
)

// 文脈規定 and 用法 already put the word in a sentence; a second one adds nothing.
const showsExample = computed(() =>
  Boolean(props.result.exampleSentence)
  && props.result.type !== 'contextual'
  && props.result.type !== 'usage',
)
</script>

<template>
  <div class="flex items-start gap-3">
    <span
      class="mt-1 flex-shrink-0 w-5 h-5 rounded-full text-xs flex items-center justify-center font-display font-bold"
      :class="result.correct ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'"
    >
      {{ result.correct ? '✓' : '✗' }}
    </span>

    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 mb-0.5">
        <span class="font-display text-xs text-ink-faint">{{ String(number).padStart(2, '0') }}</span>
        <p class="font-jp text-xl font-bold text-ink">{{ result.prompt }}</p>
      </div>

      <p v-if="showsReading" class="font-jp text-sm text-ink-faint mb-0.5">
        {{ result.reading }}
      </p>

      <p v-if="result.meaning" class="font-body text-xs text-ink-faint italic mb-1">
        {{ result.meaning }}
      </p>

      <template v-if="!result.correct && result.userChoiceText">
        <p class="font-jp text-sm text-bad line-through mb-0.5">{{ result.userChoiceText }}</p>
        <p v-if="result.whyWrong" class="font-body text-xs text-bad/70 mb-2">{{ result.whyWrong }}</p>
      </template>

      <div class="mb-2">
        <span class="font-jp font-bold text-good">{{ result.correctAnswer }}</span>
        <p v-if="result.correctAnswerReading" class="font-jp text-xs text-ink-faint">
          {{ result.correctAnswerReading }}
        </p>
      </div>

      <QuizExplanation :text="result.explanation" />

      <div
        v-if="showsExample && result.exampleSentence"
        class="mt-2 pt-2 border-t border-ink-faint/10 space-y-0.5"
      >
        <p class="font-jp text-sm text-ink-soft">{{ result.exampleSentence.japanese }}</p>
        <p class="font-jp text-xs text-ink-faint">{{ result.exampleSentence.reading }}</p>
        <p class="font-body text-xs text-ink-faint italic">{{ result.exampleSentence.english }}</p>
      </div>
    </div>
  </div>
</template>
