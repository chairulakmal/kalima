<script setup lang="ts">
import type { Level } from '~/types/index'

defineProps<{
  level: Level | null
  typeLabel: string
  answeredCount: number
  totalQuestions: number
  startedAt: number | null
  timedDurationMs: number | null
}>()
</script>

<template>
  <div class="mb-7">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span
          class="font-display text-xs font-semibold tracking-widest uppercase
                 px-2.5 py-0.5 rounded-full bg-navy text-white"
        >
          {{ level }}
        </span>
        <span class="font-jp text-xs text-ink-faint">{{ typeLabel }}</span>
      </div>

      <div class="flex items-center gap-3">
        <QuizTimer
          v-if="timedDurationMs !== null && startedAt !== null"
          :started-at="startedAt"
          :duration-ms="timedDurationMs"
        />
        <span class="font-display text-sm font-semibold text-ink-soft">
          {{ answeredCount }}<span class="text-ink-faint"> / {{ totalQuestions }}</span>
        </span>
      </div>
    </div>
    <QuizProgressBar :current="answeredCount" :total="totalQuestions" />
  </div>
</template>
