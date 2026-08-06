import type { Ref } from 'vue'
import type { ClientQuestion } from '~/types/index'

interface QuizKeyboardOptions {
  question: Ref<ClientQuestion | null | undefined>
  isSubmitting: Ref<boolean>
  hasAnswer: Ref<boolean>
  isFirst: Ref<boolean>
  onSelect: (choiceId: string) => void
  onNext: () => void
  onBack: () => void
}

// Keys 1-4 map to choice position, matching the numbers rendered on each button.
export function useQuizKeyboard(options: QuizKeyboardOptions) {
  function handleKeydown(e: KeyboardEvent) {
    const question = options.question.value
    if (!question || options.isSubmitting.value) return

    if (e.key >= '1' && e.key <= '4') {
      const choice = question.choices[Number(e.key) - 1]
      if (choice) options.onSelect(choice.id)
      return
    }

    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (!options.hasAnswer.value) return
      options.onNext()
      return
    }

    if (e.key === 'ArrowLeft' && !options.isFirst.value) options.onBack()
  }

  onMounted(() => { window.addEventListener('keydown', handleKeydown) })
  onBeforeUnmount(() => { window.removeEventListener('keydown', handleKeydown) })
}
