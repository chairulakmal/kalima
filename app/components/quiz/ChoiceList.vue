<script setup lang="ts">
import type { ClientChoice } from '~/types/index'

const props = defineProps<{
  choices: ClientChoice[]
  selectedChoiceId: string | null
  disabled: boolean
}>()

defineEmits<{ select: [choiceId: string] }>()

// Once a choice is picked the rest dim rather than lock, so the answer stays changeable.
function choiceState(choiceId: string): 'idle' | 'selected' | 'dimmed' {
  if (props.selectedChoiceId === choiceId) return 'selected'
  if (props.selectedChoiceId !== null) return 'dimmed'
  return 'idle'
}
</script>

<template>
  <div class="space-y-3 mb-8">
    <QuizChoiceButton
      v-for="(choice, i) in choices"
      :key="choice.id"
      :text="choice.text"
      :state="choiceState(choice.id)"
      :disabled="disabled"
      :number="i + 1"
      @click="$emit('select', choice.id)"
    />
  </div>
</template>
