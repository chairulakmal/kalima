<script setup lang="ts">
const store = useSessionStore()

const TYPE_LABELS: Record<string, string> = {
  reading: '漢字読み', orthography: '表記', contextual: '文脈規定',
  synonym: '言い換え類義', usage: '用法', vocab: '文字・語彙',
}
useHead(computed(() => ({
  title: `${store.level ?? 'N3'} ${TYPE_LABELS[store.type] ?? store.type} · Kalima`,
})))
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

// ── Timer (vocab sessions only) ───────────────────────────────────────────────

const VOCAB_DURATION_MS = 30 * 60 * 1000

const isVocabSession = computed(() => store.type === 'vocab')
const timeRemaining = ref(VOCAB_DURATION_MS)
let timerInterval: ReturnType<typeof setInterval> | null = null

const timerDisplay = computed(() => {
  const totalSec = Math.max(0, Math.ceil(timeRemaining.value / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const timerClass = computed(() => {
  if (timeRemaining.value <= 2 * 60 * 1000) return 'text-bad font-bold'
  if (timeRemaining.value <= 5 * 60 * 1000) return 'text-warn font-semibold'
  return 'text-ink-faint'
})

// ── Mount / unmount ───────────────────────────────────────────────────────────

onMounted(() => {
  if (!store.sessionId) {
    const restored = session.restore()
    if (!restored) { router.replace('/'); return }
  }
  window.addEventListener('keydown', handleKeydown)

  if (isVocabSession.value && store.startedAt) {
    const elapsed = Date.now() - store.startedAt
    timeRemaining.value = Math.max(0, VOCAB_DURATION_MS - elapsed)
    timerInterval = setInterval(() => {
      timeRemaining.value = Math.max(0, VOCAB_DURATION_MS - (Date.now() - store.startedAt!))
    }, 1000)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (timerInterval) clearInterval(timerInterval)
})

// ── Keyboard navigation ───────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
  if (!currentQuestion.value || isSubmitting.value) return
  const choices = currentQuestion.value.choices
  if (e.key >= '1' && e.key <= '4') {
    const idx = parseInt(e.key) - 1
    if (choices[idx]) selectChoice(choices[idx].id)
    return
  }
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    if (!hasAnswer.value) return
    if (isLast.value) submitTest()
    else next()
    return
  }
  if (e.key === 'ArrowLeft' && !isFirst.value) back()
}

function choiceState(choiceId: string): 'idle' | 'selected' | 'dimmed' {
  if (selectedChoiceId.value === choiceId) return 'selected'
  if (selectedChoiceId.value !== null) return 'dimmed'
  return 'idle'
}

// ── Type label ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  reading:     '漢字読み',
  orthography: '表記',
  contextual:  '文脈規定',
  synonym:     '言い換え類義',
  usage:       '用法',
  vocab:       '文字・語彙',
}

// For vocab sessions, show the current question's individual type.
const typeLabel = computed(() => {
  if (store.type === 'vocab' && currentQuestion.value) {
    return TYPE_LABELS[currentQuestion.value.type] ?? '語彙'
  }
  return TYPE_LABELS[store.type] ?? '語彙'
})
</script>

<template>
  <div class="min-h-screen bg-paper">
    <div class="max-w-lg mx-auto px-4 py-8">

      <!-- Header: level chip + type label + timer + progress -->
      <div class="mb-7">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="font-display text-xs font-semibold tracking-widest uppercase
                         px-2.5 py-0.5 rounded-full bg-navy text-white">
              {{ store.level }}
            </span>
            <span class="font-jp text-xs text-ink-faint">{{ typeLabel }}</span>
          </div>

          <div class="flex items-center gap-3">
            <!-- Countdown timer — vocab sessions only -->
            <span v-if="isVocabSession"
                  class="font-display text-sm tabular-nums transition-colors"
                  :class="timerClass">
              {{ timerDisplay }}
            </span>
            <span class="font-display text-sm font-semibold text-ink-soft">
              {{ answeredCount }}<span class="text-ink-faint"> / {{ store.questions.length }}</span>
            </span>
          </div>
        </div>
        <QuizProgressBar :current="answeredCount" :total="store.questions.length" />
      </div>

      <template v-if="currentQuestion">
        <!-- Question card -->
        <div
          class="bg-white rounded-2xl p-7 mb-4 border-l-[3px] border-cerulean"
          style="box-shadow: var(--shadow);"
        >
          <p class="font-display text-xs font-semibold text-ink-faint tracking-widest mb-4">
            {{ String(currentIndex + 1).padStart(2, '0') }}
          </p>
          <QuizCard
            :prompt="currentQuestion.prompt"
            :context="currentQuestion.context"
            :type="currentQuestion.type"
          />
        </div>

        <!-- Choices -->
        <div class="space-y-3 mb-8">
          <QuizChoiceButton
            v-for="(choice, i) in currentQuestion.choices"
            :key="choice.id"
            :text="choice.text"
            :state="choiceState(choice.id)"
            :disabled="isSubmitting"
            :number="i + 1"
            @click="selectChoice(choice.id)"
          />
        </div>

        <!-- Navigation -->
        <div class="flex gap-3">
          <button
            v-if="!isFirst"
            class="btn-secondary flex-none px-5 py-3 rounded-xl text-sm"
            :disabled="isSubmitting"
            @click="back"
          >
            ← Back
          </button>

          <button
            v-if="!isLast"
            class="btn-primary flex-1 py-3 rounded-xl text-sm"
            :disabled="!hasAnswer || isSubmitting"
            @click="next"
          >
            Next →
          </button>

          <button
            v-if="isLast"
            class="btn-primary flex-1 py-3 rounded-xl text-sm"
            :disabled="!hasAnswer || isSubmitting"
            @click="submitTest"
          >
            {{ isSubmitting ? '提出中…' : 'Submit Test' }}
          </button>
        </div>

        <p v-if="submitError" class="mt-3 text-center font-body text-sm text-bad">
          {{ submitError }}
        </p>

        <p class="mt-5 text-center font-body text-xs text-ink-faint">
          1–4 to select &nbsp;·&nbsp; ← → to navigate
        </p>
      </template>
    </div>
  </div>
</template>
