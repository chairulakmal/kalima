<script setup lang="ts">
import type { QuestionType } from '~/types/index'

export interface TypeEntry {
  type: QuestionType
  label: string
  correct: number
  total: number
  pct: number   // 0–1; only entries that were actually tested are passed
}

const props = defineProps<{ entries: TypeEntry[] }>()

// N derives from however many tested types were passed (2–5)
const n = computed(() => props.entries.length)

// SVG layout constants
const CX = 110   // centre x
const CY = 108   // centre y (nudged down to give top label breathing room)
const R  = 68    // max data radius
const LR = 86    // label placement radius

function angle(i: number) {
  return -Math.PI / 2 + (2 * Math.PI * i) / n.value
}

function px(i: number, s: number) { return +(CX + R * s * Math.cos(angle(i))).toFixed(2) }
function py(i: number, s: number) { return +(CY + R * s * Math.sin(angle(i))).toFixed(2) }

function ring(s: number) {
  return Array.from({ length: n.value }, (_, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i, s)},${py(i, s)}`
  ).join('') + 'Z'
}

function lx(i: number) { return +(CX + LR * Math.cos(angle(i))).toFixed(2) }
function ly(i: number) { return +(CY + LR * Math.sin(angle(i))).toFixed(2) }

function anchor(i: number): string {
  const x = Math.cos(angle(i))
  return x > 0.1 ? 'start' : x < -0.1 ? 'end' : 'middle'
}

function baseline(i: number): string {
  const y = Math.sin(angle(i))
  return y < -0.1 ? 'auto' : y > 0.1 ? 'hanging' : 'middle'
}
</script>

<template>
  <svg
    viewBox="0 0 220 210"
    xmlns="http://www.w3.org/2000/svg"
    class="w-full"
    aria-hidden="true"
  >
    <!-- Grid rings at 25 / 50 / 75 / 100 % -->
    <path
      v-for="s in [0.25, 0.5, 0.75, 1]"
      :key="s"
      :d="ring(s)"
      fill="none"
      stroke="var(--line)"
      stroke-width="0.75"
    />

    <!-- Axis lines from centre to each vertex -->
    <line
      v-for="(_, i) in entries"
      :key="`ax-${i}`"
      :x1="CX" :y1="CY"
      :x2="px(i, 1)" :y2="py(i, 1)"
      stroke="var(--line)"
      stroke-width="0.75"
    />

    <!-- Filled data area -->
    <path
      :d="entries.map((e, i) => `${i === 0 ? 'M' : 'L'}${px(i, e.pct)},${py(i, e.pct)}`).join('') + 'Z'"
      fill="rgba(45,125,210,0.12)"
      stroke="var(--cerulean)"
      stroke-width="2"
      stroke-linejoin="round"
    />

    <!-- Vertex dots -->
    <circle
      v-for="(e, i) in entries"
      :key="`dot-${e.type}`"
      :cx="px(i, e.pct)"
      :cy="py(i, e.pct)"
      r="3.5"
      fill="var(--cerulean)"
    />

    <!-- Type labels -->
    <text
      v-for="(e, i) in entries"
      :key="`lbl-${e.type}`"
      :x="lx(i)"
      :y="ly(i)"
      :text-anchor="anchor(i)"
      :dominant-baseline="baseline(i)"
      font-size="11"
      style="font-family: var(--f-jp);"
      fill="var(--ink-soft)"
    >{{ e.label }}</text>
  </svg>
</template>
