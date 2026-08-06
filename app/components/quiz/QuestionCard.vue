<script setup lang="ts">
import type { ClientQuestion } from '~/types/index'

defineProps<{
  question: ClientQuestion
  number: number
}>()
</script>

<template>
  <div
    class="bg-white rounded-2xl p-7 mb-4 border-l-[3px] border-cerulean"
    style="box-shadow: var(--shadow);"
  >
    <p class="font-display text-xs font-semibold text-ink-faint tracking-widest mb-4">
      {{ String(number).padStart(2, '0') }}
    </p>
    <QuizCard
      :prompt="question.prompt"
      :context="question.context"
      :type="question.type"
    />
  </div>
</template>
