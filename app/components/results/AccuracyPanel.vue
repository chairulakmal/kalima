<script setup lang="ts">
import type { TypeEntry } from '~/types/index'

defineProps<{ entries: TypeEntry[] }>()
</script>

<template>
  <div class="bg-white rounded-2xl p-5 mb-5" style="box-shadow: var(--shadow);">
    <p class="font-display text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3">
      Per-type accuracy
    </p>
    <ResultsTypeChart :entries="entries" />

    <div
      class="grid gap-1 mt-3"
      :style="{ gridTemplateColumns: `repeat(${entries.length}, 1fr)` }"
    >
      <div v-for="e in entries" :key="e.type" class="text-center">
        <p class="font-jp text-xs text-ink-faint mb-0.5">{{ e.label }}</p>
        <p
          class="font-display text-xs font-bold"
          :class="e.pct >= 0.7 ? 'text-good' : e.pct >= 0.4 ? 'text-warn' : 'text-bad'"
        >
          {{ e.correct }}/{{ e.total }}
        </p>
      </div>
    </div>
  </div>
</template>
