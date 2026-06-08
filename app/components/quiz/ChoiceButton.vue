<script setup lang="ts">
defineProps<{
  text: string
  state: 'idle' | 'selected' | 'confirmed' | 'correct' | 'wrong' | 'dimmed'
  disabled: boolean
  number?: number
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    :disabled="disabled"
    class="w-full text-left px-5 py-4 rounded-xl border-2 font-jp font-medium text-base
           transition-all duration-150 min-h-[52px]"
    :class="{
      'border-line   bg-white        text-ink      hover:border-cerulean hover:bg-surface-cool cursor-pointer': state === 'idle',
      'border-cerulean bg-surface-cool text-cerulean ring-2 ring-cerulean/30 cursor-pointer':                    state === 'selected',
      'border-cerulean bg-surface-cool text-cerulean cursor-default':                                            state === 'confirmed',
      'border-good   bg-good/10     text-good     cursor-default':                                               state === 'correct',
      'border-bad    bg-bad/10      text-bad      cursor-default':                                               state === 'wrong',
      'border-line   bg-white       text-ink-faint cursor-default opacity-50':                                   state === 'dimmed',
    }"
    @click="$emit('click')"
  >
    <span
      v-if="number !== undefined"
      class="inline-block w-5 mr-3 text-center opacity-40 font-display font-semibold text-sm"
    >{{ number }}</span>{{ text }}
  </button>
</template>
