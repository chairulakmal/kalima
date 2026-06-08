export function useQuiz() {
  const store = useSessionStore()
  const router = useRouter()

  const currentIndex = ref(0)
  const answers = ref(new Map<string, string>())
  const isSubmitting = ref(false)
  const submitError = ref<string | null>(null)

  const currentQuestion = computed(() => store.questions[currentIndex.value] ?? null)
  const isLast = computed(() => currentIndex.value === store.questions.length - 1)
  const isFirst = computed(() => currentIndex.value === 0)

  const selectedChoiceId = computed(() =>
    currentQuestion.value ? (answers.value.get(currentQuestion.value.id) ?? null) : null,
  )
  const hasAnswer = computed(() => selectedChoiceId.value !== null)
  const answeredCount = computed(() => answers.value.size)

  function selectChoice(choiceId: string) {
    if (isSubmitting.value || !currentQuestion.value) return
    answers.value.set(currentQuestion.value.id, choiceId)
  }

  function next() {
    if (!isLast.value) currentIndex.value++
  }

  function back() {
    if (!isFirst.value) currentIndex.value--
  }

  async function submitTest() {
    if (isSubmitting.value || !store.sessionId) return

    const payload = store.questions.map(q => ({
      questionId: q.id,
      choiceId: answers.value.get(q.id) ?? '',
    }))

    isSubmitting.value = true
    submitError.value = null
    try {
      await $fetch('/api/session/submit', {
        method: 'POST',
        body: { sessionId: store.sessionId, answers: payload },
      })
      router.push(`/results?sessionId=${store.sessionId}`)
    } catch {
      isSubmitting.value = false
      submitError.value = 'Failed to submit. Please try again.'
    }
  }

  return {
    currentIndex,
    currentQuestion,
    selectedChoiceId,
    hasAnswer,
    answeredCount,
    isFirst,
    isLast,
    isSubmitting,
    submitError,
    selectChoice,
    next,
    back,
    submitTest,
  }
}
