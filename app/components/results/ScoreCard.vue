<script setup lang="ts">
const props = defineProps<{
  level: string
  type: string
  score: number
  totalQuestions: number
  startedAt: number
  completedAt: number
}>()

const percentage = computed(() => Math.round((props.score / props.totalQuestions) * 100))

const durationStr = computed(() => {
  const s = Math.round((props.completedAt - props.startedAt) / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
})

const scoreColor = computed(() => {
  const p = percentage.value
  if (p === 100) return 'text-gold'
  if (p >= 70)  return 'text-good'
  if (p >= 40)  return 'text-warn'
  return 'text-bad'
})

const scorePhrase = computed(() => {
  const p = percentage.value
  if (p === 100) return { jp: '全問正解！', en: 'Perfect round' }
  if (p >= 70)   return { jp: 'よくできました', en: 'Well done' }
  if (p >= 40)   return { jp: '惜しい', en: 'Almost there' }
  return { jp: 'がんばろう', en: 'Keep practicing' }
})
</script>

<template>
  <div
    class="bg-white rounded-2xl p-8 mb-5 text-center border-l-[3px] border-cerulean"
    style="box-shadow: var(--shadow);"
  >
    <p class="font-display text-xs font-semibold text-ink-faint uppercase tracking-widest mb-3">
      {{ level }} · {{ questionTypeLabel(type) }} · {{ durationStr }}
    </p>
    <p class="font-display font-bold mb-1 leading-none text-7xl" :class="scoreColor">
      {{ score }}<span class="text-4xl text-ink-faint">/{{ totalQuestions }}</span>
    </p>
    <p class="font-jp text-lg mt-3" :class="scoreColor">
      {{ scorePhrase.jp }}
      <span class="font-body text-sm text-ink-faint ml-2">· {{ scorePhrase.en }}</span>
    </p>
  </div>
</template>
