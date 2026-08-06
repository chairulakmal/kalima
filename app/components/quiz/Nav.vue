<script setup lang="ts">
defineProps<{
  isFirst: boolean
  isLast: boolean
  hasAnswer: boolean
  isSubmitting: boolean
  submitError: string | null
}>()

defineEmits<{ back: []; next: [] }>()
</script>

<template>
  <div class="flex gap-3">
    <button
      v-if="!isFirst"
      class="btn-secondary flex-none px-5 py-3 rounded-xl text-sm"
      :disabled="isSubmitting"
      @click="$emit('back')"
    >
      ← Back
    </button>

    <button
      class="btn-primary flex-1 py-3 rounded-xl text-sm"
      :disabled="!hasAnswer || isSubmitting"
      @click="$emit('next')"
    >
      <template v-if="!isLast">Next →</template>
      <template v-else>{{ isSubmitting ? '提出中…' : 'Submit Test' }}</template>
    </button>
  </div>

  <p v-if="submitError" class="mt-3 text-center font-body text-sm text-bad">
    {{ submitError }}
  </p>

  <p class="mt-5 text-center font-body text-xs text-ink-faint">
    1–4 to select &nbsp;·&nbsp; ← → to navigate
  </p>
</template>
