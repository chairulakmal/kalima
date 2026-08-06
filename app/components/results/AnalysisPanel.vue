<script setup lang="ts">
defineProps<{
  loading: boolean
  analysis: string | null
}>()
</script>

<template>
  <div class="bg-surface-cool border border-cerulean/20 rounded-2xl p-5 mb-5">
    <p class="font-display text-xs font-semibold text-cerulean uppercase tracking-wide mb-3">
      AI Analysis
    </p>
    <UiLoadingSpinner v-if="loading" class="py-2" />
    <p v-else-if="analysis" class="font-body text-sm text-ink-soft leading-relaxed">
      {{ analysis }}
    </p>
    <!-- A missing analysis is almost always the daily budget, not a failure worth alarming about. -->
    <p v-else class="font-body text-sm text-ink-faint">
      Today's AI analysis quota has been reached. Results and explanations are still available below.
    </p>
  </div>
</template>
