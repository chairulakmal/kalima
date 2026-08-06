<script setup lang="ts">
const props = defineProps<{
  startedAt: number
  durationMs: number
}>()

// Remaining time is recomputed from `startedAt` on every tick rather than
// decremented, so a backgrounded tab that throttles the interval still shows the
// true remaining time when it comes back.
const remainingMs = ref(props.durationMs)
let interval: ReturnType<typeof setInterval> | null = null

function sync() {
  remainingMs.value = Math.max(0, props.durationMs - (Date.now() - props.startedAt))
}

onMounted(() => {
  sync()
  interval = setInterval(sync, 1000)
})

onBeforeUnmount(() => {
  if (interval) clearInterval(interval)
})

const display = computed(() => {
  const totalSec = Math.max(0, Math.ceil(remainingMs.value / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const urgencyClass = computed(() => {
  if (remainingMs.value <= 2 * 60 * 1000) return 'text-bad font-bold'
  if (remainingMs.value <= 5 * 60 * 1000) return 'text-warn font-semibold'
  return 'text-ink-faint'
})
</script>

<template>
  <span
    class="font-display text-sm tabular-nums transition-colors"
    :class="urgencyClass"
  >
    {{ display }}
  </span>
</template>
