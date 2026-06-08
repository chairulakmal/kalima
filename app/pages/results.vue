<script setup lang="ts">
import type { QuestionResult } from '~/types/index'

interface ResultsResponse {
  sessionId: string
  level: string
  type: string
  score: number
  totalQuestions: number
  startedAt: number
  completedAt: number
  results: QuestionResult[]
}

const TYPE_LABELS: Record<string, string> = {
  reading:     '漢字読み',
  orthography: '表記',
  contextual:  '文脈規定',
  synonym:     '言い換え類義',
  usage:       '用法',
  vocab:       '文字・語彙',
}

const route = useRoute()
const session = useSession()
const sessionId = route.query.sessionId as string

const analysis = ref<string | null>(null)
const analysisLoading = ref(false)

const { data, error } = await useAsyncData<ResultsResponse>(
  `results-${sessionId}`,
  () => $fetch(`/api/session/results?sessionId=${sessionId}`),
)

onMounted(async () => {
  session.clear()
  if (!sessionId) return
  analysisLoading.value = true
  try {
    const res = await $fetch<{ analysis: string }>('/api/session/analysis', {
      method: 'POST',
      body: { sessionId },
    })
    analysis.value = res.analysis
  } catch {
    analysis.value = null
  } finally {
    analysisLoading.value = false
  }
})

const percentage = computed(() =>
  data.value ? Math.round((data.value.score / data.value.totalQuestions) * 100) : 0,
)

const durationStr = computed(() => {
  if (!data.value) return ''
  const s = Math.round((data.value.completedAt - data.value.startedAt) / 1000)
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
  <div class="min-h-screen bg-paper py-10 px-4">
    <div class="max-w-lg mx-auto">

      <div v-if="error" class="text-center text-bad py-20 font-body">Failed to load results.</div>

      <template v-else-if="data">

        <!-- Score card -->
        <div class="bg-white rounded-2xl p-8 mb-5 text-center border-l-[3px] border-cerulean"
             style="box-shadow: var(--shadow);">
          <p class="font-display text-xs font-semibold text-ink-faint uppercase tracking-widest mb-3">
            {{ data.level }} · {{ TYPE_LABELS[data.type] ?? data.type }} · {{ durationStr }}
          </p>
          <p class="font-display font-bold mb-1 leading-none" :class="[scoreColor, 'text-7xl']">
            {{ data.score }}<span class="text-4xl text-ink-faint">/{{ data.totalQuestions }}</span>
          </p>
          <p class="font-jp text-lg mt-3" :class="scoreColor">
            {{ scorePhrase?.jp }}
            <span class="font-body text-sm text-ink-faint ml-2">· {{ scorePhrase?.en }}</span>
          </p>
        </div>

        <!-- AI Analysis -->
        <div class="bg-surface-cool border border-cerulean/20 rounded-2xl p-5 mb-5">
          <p class="font-display text-xs font-semibold text-cerulean uppercase tracking-wide mb-3">
            AI Analysis
          </p>
          <UiLoadingSpinner v-if="analysisLoading" class="py-2" />
          <p v-else-if="analysis" class="font-body text-sm text-ink-soft leading-relaxed">
            {{ analysis }}
          </p>
          <p v-else class="font-body text-sm text-ink-faint">
            Today's AI analysis quota has been reached. Results and explanations are still available below.
          </p>
        </div>

        <!-- Per-question breakdown -->
        <div class="space-y-3 mb-8">
          <div
            v-for="(r, i) in data.results"
            :key="r.questionId"
            class="bg-white rounded-xl p-4"
            style="box-shadow: 0 2px 8px -4px rgba(15,28,46,0.12);"
          >
            <div class="flex items-start gap-3">
              <!-- Correct/wrong indicator -->
              <span
                class="mt-1 flex-shrink-0 w-5 h-5 rounded-full text-xs flex items-center justify-center font-display font-bold"
                :class="r.correct
                  ? 'bg-good/10 text-good'
                  : 'bg-bad/10 text-bad'"
              >
                {{ r.correct ? '✓' : '✗' }}
              </span>

              <div class="flex-1 min-w-0">
                <!-- Question number + prompt -->
                <div class="flex items-baseline gap-2 mb-0.5">
                  <span class="font-display text-xs text-ink-faint">{{ String(i + 1).padStart(2, '0') }}</span>
                  <p class="font-jp text-xl font-bold text-ink">{{ r.prompt }}</p>
                </div>

                <!-- Reading (if different from prompt; not shown for contextual since prompt is the sentence) -->
                <p v-if="r.reading && r.reading !== r.prompt && r.type !== 'contextual'"
                   class="font-jp text-sm text-ink-faint mb-1">
                  {{ r.reading }}
                </p>

                <!-- Wrong answer crossed out + why -->
                <template v-if="!r.correct && r.userChoiceText">
                  <p class="font-jp text-sm text-bad line-through mb-0.5">{{ r.userChoiceText }}</p>
                  <p v-if="r.whyWrong" class="font-body text-xs text-bad/70 mb-2">{{ r.whyWrong }}</p>
                </template>

                <!-- Correct answer -->
                <div class="mb-2">
                  <span class="font-jp font-bold text-good">{{ r.correctAnswer }}</span>
                  <p v-if="r.correctAnswerReading"
                     class="font-jp text-xs text-ink-faint">{{ r.correctAnswerReading }}</p>
                </div>

                <!-- Explanation -->
                <QuizExplanation :text="r.explanation" />

                <!-- Example sentence (suppressed for contextual/usage — the prompt/answer already is the sentence) -->
                <div v-if="r.exampleSentence && r.type !== 'contextual' && r.type !== 'usage'"
                     class="mt-2 pt-2 border-t border-ink-faint/10 space-y-0.5">
                  <p class="font-jp text-sm text-ink-soft">{{ r.exampleSentence.japanese }}</p>
                  <p class="font-jp text-xs text-ink-faint">{{ r.exampleSentence.reading }}</p>
                  <p class="font-body text-xs text-ink-faint italic">{{ r.exampleSentence.english }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Try again -->
        <NuxtLink to="/" class="block w-full">
          <button class="btn-primary w-full py-4 rounded-xl text-sm">
            Try Again
          </button>
        </NuxtLink>
      </template>

      <div v-else class="flex items-center justify-center py-20">
        <UiLoadingSpinner />
      </div>
    </div>
  </div>
</template>
