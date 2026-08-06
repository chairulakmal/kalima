<script setup lang="ts">
const VOCAB_DURATION_MS = 30 * 60 * 1000

const store = useSessionStore()
const session = useSession()
const router = useRouter()
const {
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
} = useQuiz()

const direction = ref<'forward' | 'backward'>('forward')
const transitionName = computed(() => `quiz-${direction.value}`)

function goNext() {
  direction.value = 'forward'
  if (isLast.value) submitTest()
  else next()
}

function goBack() {
  direction.value = 'backward'
  back()
}

useQuizKeyboard({
  question: currentQuestion,
  isSubmitting,
  hasAnswer,
  isFirst,
  onSelect: selectChoice,
  onNext: goNext,
  onBack: goBack,
})

onMounted(() => {
  if (!store.sessionId && !session.restore()) router.replace('/')
})

// Only the full 35-question vocab section is timed; single-type and review drills are not.
const timedDurationMs = computed(() => (store.type === 'vocab' ? VOCAB_DURATION_MS : null))

// In a mixed session each question announces its own type; a single-type session
// keeps showing the session's.
const typeLabel = computed(() => {
  const isMixed = store.type === 'vocab' || store.type === 'review'
  const type = isMixed && currentQuestion.value ? currentQuestion.value.type : store.type
  return questionTypeLabel(type, '語彙')
})

useHead(computed(() => ({
  title: `${store.level ?? 'N3'} ${questionTypeLabel(store.type)} · Kalima`,
})))
</script>

<template>
  <div class="min-h-screen bg-paper">
    <div class="max-w-lg mx-auto px-4 py-8">
      <QuizHeader
        :level="store.level"
        :type-label="typeLabel"
        :answered-count="answeredCount"
        :total-questions="store.questions.length"
        :started-at="store.startedAt"
        :timed-duration-ms="timedDurationMs"
      />

      <Transition :name="transitionName" mode="out-in">
        <div v-if="currentQuestion" :key="currentIndex">
          <QuizQuestionCard :question="currentQuestion" :number="currentIndex + 1" />

          <QuizChoiceList
            :choices="currentQuestion.choices"
            :selected-choice-id="selectedChoiceId"
            :disabled="isSubmitting"
            @select="selectChoice"
          />

          <QuizNav
            :is-first="isFirst"
            :is-last="isLast"
            :has-answer="hasAnswer"
            :is-submitting="isSubmitting"
            :submit-error="submitError"
            @back="goBack"
            @next="goNext"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.quiz-forward-enter-active,
.quiz-forward-leave-active,
.quiz-backward-enter-active,
.quiz-backward-leave-active {
  transition: transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
              opacity 220ms ease-out;
}

.quiz-forward-enter-from  { transform: translateX(28px); opacity: 0; }
.quiz-forward-leave-to    { transform: translateX(-28px); opacity: 0; }

.quiz-backward-enter-from { transform: translateX(-28px); opacity: 0; }
.quiz-backward-leave-to   { transform: translateX(28px); opacity: 0; }
</style>
