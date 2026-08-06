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

useHead({ title: 'Results · Kalima' })

const route = useRoute()
const session = useSession()
const reviewQueue = useReviewQueue()
const { analysis, loading: analysisLoading, fetchAnalysis } = useSessionAnalysis()

const sessionId = route.query.sessionId as string

const { data, error } = await useAsyncData<ResultsResponse>(
  `results-${sessionId}`,
  () => $fetch<ResultsResponse>('/api/session/results', { query: { sessionId } }),
)

const typeAccuracy = computed(() => (data.value ? buildTypeAccuracy(data.value.results) : null))

const failsAddedCount = computed(() =>
  data.value ? data.value.results.filter(r => r.correct === false).length : 0,
)

onMounted(() => {
  session.clear()

  reviewQueue.init()
  if (data.value) {
    reviewQueue.addFails(data.value.results)
    if (data.value.type === 'review') reviewQueue.removeCorrects(data.value.results)
  }

  if (sessionId) fetchAnalysis(sessionId)
})
</script>

<template>
  <div class="min-h-screen bg-paper py-10 px-4">
    <div class="max-w-lg mx-auto">

      <div v-if="error" class="text-center text-bad py-20 font-body">Failed to load results.</div>

      <template v-else-if="data">
        <ResultsScoreCard
          :level="data.level"
          :type="data.type"
          :score="data.score"
          :total-questions="data.totalQuestions"
          :started-at="data.startedAt"
          :completed-at="data.completedAt"
        />

        <p v-if="failsAddedCount > 0" class="text-center font-body text-xs text-ink-faint mb-4">
          {{ failsAddedCount }} word{{ failsAddedCount === 1 ? '' : 's' }} added to review queue
        </p>

        <ResultsAccuracyPanel v-if="typeAccuracy" :entries="typeAccuracy" />

        <ResultsAnalysisPanel :loading="analysisLoading" :analysis="analysis" />

        <div class="space-y-3 mb-8">
          <div
            v-for="(r, i) in data.results"
            :key="r.questionId"
            class="bg-white rounded-xl p-4 result-item"
            :style="{ '--i': i, boxShadow: '0 2px 8px -4px rgba(15,28,46,0.12)' }"
          >
            <ResultsQuestionResult :result="r" :number="i + 1" />
          </div>
        </div>

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

<style scoped>
@keyframes slide-up {
  from { transform: translateY(12px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.result-item {
  animation: slide-up 280ms ease-out both;
  animation-delay: calc(var(--i, 0) * 55ms);
}
</style>
