<script setup lang="ts">
import type { Word, ExamDistractor } from '~/types/index'

const RANKS = ['S', 'A', 'B', 'C', 'D', 'F'] as const
type Rank = (typeof RANKS)[number]

const RANK_COLORS: Record<Rank, string> = {
  S: 'bg-yellow-400 text-yellow-900',
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-orange-400 text-white',
  D: 'bg-red-400 text-white',
  F: 'bg-red-700 text-white',
}

const TYPE_LABELS: Record<string, string> = {
  reading: '漢字読み (kanji reading)',
  orthography: '表記 (kanji writing)',
  contextual: '文脈規定 (contextual fill-in)',
  synonym: '言い換え類義 (synonym)',
  usage: '用法 (correct usage)',
}

interface Review {
  id: string
  reviewerEmail: string
  rank: string
  note: string | null
  updatedAt: string
}

interface DetailResponse {
  id: string
  wordId: string
  type: string
  model: string
  version: number
  correctAnswer: string
  correctReading: string | null
  distractors: ExamDistractor[]
  explanation: string
  createdAt: string
  updatedAt: string
  word: Word | null
  reviews: Review[]
  effectiveRank: string | null
  deletable: boolean
}

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

// useRequestFetch forwards the httpOnly admin_session cookie during SSR so the
// detail renders server-side on a hard refresh instead of fetching client-only.
const requestFetch = useRequestFetch()
const { data, error, refresh } = await useAsyncData<DetailResponse>(
  `admin-question-${id}`,
  () => requestFetch(`/api/admin/questions/${id}`),
)

// ── Review form ────────────────────────────────────────────────────────────────

const reviewRank = ref<Rank | null>(null)
const reviewNote = ref('')
const reviewSubmitting = ref(false)
const reviewError = ref<string | null>(null)
const reviewSuccess = ref(false)

async function submitReview() {
  if (!reviewRank.value) return
  reviewSubmitting.value = true
  reviewError.value = null
  reviewSuccess.value = false
  try {
    const res = await $fetch<{ reviews: Review[]; effectiveRank: string | null; deletable: boolean }>(
      `/api/admin/questions/${id}/review`,
      {
        method: 'POST',
        body: { rank: reviewRank.value, note: reviewNote.value.trim() || undefined },
      },
    )
    if (data.value) {
      data.value.reviews = res.reviews
      data.value.effectiveRank = res.effectiveRank
      data.value.deletable = res.deletable
    }
    reviewSuccess.value = true
    reviewNote.value = ''
  } catch (e: unknown) {
    reviewError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Failed to submit review.'
  } finally {
    reviewSubmitting.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

const deleting = ref(false)
async function deleteQuestion() {
  if (!confirm('Delete this question? This cannot be undone.')) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/questions/${id}`, { method: 'DELETE' })
    router.replace('/admin')
  } catch (e: unknown) {
    alert((e as { data?: { message?: string } })?.data?.message ?? 'Delete failed.')
    deleting.value = false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function modelLabel(model: string): string {
  if (model === 'fallback') return 'Fallback'
  if (model.includes('haiku-4-5')) return 'Haiku 4.5'
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('sonnet-4')) return 'Sonnet 4'
  if (model.includes('opus-4')) return 'Opus 4'
  return model
}

function formatDate(d: string) {
  return new Date(d).toLocaleString()
}

function rankClass(rank: string | null): string {
  return rank ? RANK_COLORS[rank as Rank] ?? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-400'
}
</script>

<template>
  <div class="min-h-screen bg-paper py-8 px-4">
    <div class="max-w-2xl mx-auto">
      <NuxtLink to="/admin"
        class="inline-flex items-center gap-1 font-display text-sm font-semibold text-cerulean hover:text-navy mb-6 transition-colors">
        ← Back to list
      </NuxtLink>

      <div v-if="error" class="text-center text-bad py-20 font-body">Failed to load question.</div>

      <template v-else-if="data">
        <!-- Word card + rank + delete -->
        <div class="bg-white rounded-2xl p-6 mb-4 border-l-[3px] border-cerulean" style="box-shadow: var(--shadow);">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <p class="font-jp text-5xl font-bold text-navy mb-1">{{ data.word?.expression ?? data.wordId }}</p>
              <p v-if="data.word" class="font-jp text-lg text-ink-faint">{{ data.word.reading }}</p>
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">
              <div class="flex items-center gap-2">
                <span v-if="data.word"
                  class="font-display text-xs font-semibold px-2.5 py-1 rounded-full bg-navy text-white">
                  {{ data.word.level }}
                </span>
                <span class="font-display text-sm font-bold px-3 py-1 rounded-full" :class="rankClass(data.effectiveRank)">
                  {{ data.effectiveRank ?? '—' }}
                </span>
              </div>
              <button
                v-if="data.deletable"
                @click="deleteQuestion"
                :disabled="deleting"
                class="font-display text-xs font-semibold text-bad hover:text-bad/70 disabled:opacity-40
                       transition-colors border border-bad/30 rounded-lg px-3 py-1 hover:bg-bad/5"
              >
                {{ deleting ? 'Deleting…' : 'Delete question' }}
              </button>
              <p v-else class="font-body text-xs text-ink-faint">
                Ranked {{ data.effectiveRank }} — change rank to delete
              </p>
            </div>
          </div>

          <p v-if="data.word" class="font-body text-base text-ink-soft font-semibold mb-4">{{ data.word.meaning }}</p>

          <div v-if="data.word?.exampleSentence" class="border-t border-line pt-4 space-y-1">
            <p class="font-jp text-sm text-ink">{{ data.word.exampleSentence.japanese }}</p>
            <p class="font-jp text-sm text-ink-faint">{{ data.word.exampleSentence.reading }}</p>
            <p class="font-body text-sm text-ink-soft italic">{{ data.word.exampleSentence.english }}</p>
          </div>
        </div>

        <!-- Metadata -->
        <div class="bg-white rounded-2xl p-5 mb-4 flex flex-wrap gap-x-6 gap-y-2"
             style="box-shadow: 0 2px 8px -4px rgba(15,28,46,0.10);">
          <div>
            <span class="font-display text-xs text-ink-faint">Model</span>
            <span
              class="ml-2 font-display font-semibold px-2 py-0.5 rounded-full text-xs"
              :class="data.model === 'seed' ? 'bg-surface-cool text-cerulean'
                     : data.model === 'fallback' ? 'bg-warn/10 text-warn'
                     : 'bg-surface-cool text-cerulean'"
            >
              {{ modelLabel(data.model) }}
            </span>
          </div>
          <div>
            <span class="font-display text-xs text-ink-faint">Type</span>
            <span class="ml-2 font-jp font-medium text-ink-soft text-xs">{{ TYPE_LABELS[data.type] ?? data.type }}</span>
          </div>
          <div>
            <span class="font-display text-xs text-ink-faint">Version</span>
            <span class="ml-2 font-display font-semibold text-ink-soft text-sm">{{ data.version }}</span>
          </div>
          <div>
            <span class="font-display text-xs text-ink-faint">Generated</span>
            <span class="ml-2 font-body text-ink-soft text-sm">{{ formatDate(data.createdAt) }}</span>
          </div>
        </div>

        <!-- Correct answer -->
        <div class="bg-white rounded-2xl p-5 mb-4" style="box-shadow: 0 2px 8px -4px rgba(15,28,46,0.10);">
          <p class="font-display text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Correct Answer</p>
          <p class="font-jp text-2xl font-bold text-good">{{ data.correctAnswer }}</p>
          <p v-if="data.correctReading" class="font-jp text-sm text-ink-faint mt-0.5">{{ data.correctReading }}</p>
        </div>

        <!-- Explanation -->
        <div class="bg-surface-cool border border-cerulean/20 rounded-2xl p-5 mb-4">
          <p class="font-display text-xs font-semibold text-cerulean uppercase tracking-wide mb-2">Explanation</p>
          <p class="font-body text-sm text-ink-soft leading-relaxed">{{ data.explanation }}</p>
        </div>

        <!-- Distractors -->
        <div class="bg-white rounded-2xl p-5 mb-4" style="box-shadow: 0 2px 8px -4px rgba(15,28,46,0.10);">
          <p class="font-display text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3">Wrong Choices</p>
          <div class="space-y-3">
            <div
              v-for="(d, i) in data.distractors"
              :key="i"
              class="rounded-xl border border-bad/20 bg-bad/5 px-4 py-3"
            >
              <p class="font-jp text-sm font-bold text-bad mb-1">{{ d.text }}</p>
              <p v-if="d.whyWrong" class="font-body text-xs text-bad/70">{{ d.whyWrong }}</p>
            </div>
          </div>
        </div>

        <!-- Reviews -->
        <div class="bg-white rounded-2xl p-5 mb-4" style="box-shadow: 0 2px 8px -4px rgba(15,28,46,0.10);">
          <div class="flex items-center justify-between mb-3">
            <p class="font-display text-xs font-semibold text-ink-faint uppercase tracking-wide">
              Reviews ({{ data.reviews.length }})
            </p>
            <span
              v-if="data.reviews.length"
              class="font-display text-xs font-bold px-2 py-0.5 rounded-full"
              :class="rankClass(data.effectiveRank)"
            >
              Effective: {{ data.effectiveRank ?? '—' }}
            </span>
          </div>
          <div v-if="data.reviews.length" class="space-y-2">
            <div
              v-for="r in data.reviews"
              :key="r.id"
              class="flex items-start gap-3 text-sm border-b border-line pb-2 last:border-0 last:pb-0"
            >
              <span class="flex-shrink-0 font-display text-xs font-bold px-2 py-0.5 rounded-full mt-0.5"
                    :class="rankClass(r.rank)">
                {{ r.rank }}
              </span>
              <div class="flex-1 min-w-0">
                <p v-if="r.note" class="font-body text-ink-faint text-xs">{{ r.note }}</p>
                <p v-else class="font-body text-ink-faint text-xs italic">No note.</p>
              </div>
              <span class="flex-shrink-0 font-body text-xs text-ink-faint">
                {{ new Date(r.updatedAt).toLocaleDateString() }}
              </span>
            </div>
          </div>
          <p v-else class="font-body text-sm text-ink-faint italic">No reviews yet.</p>
        </div>

        <!-- Review form -->
        <div class="bg-paper border border-line rounded-2xl p-5">
          <p class="font-display text-xs font-semibold text-ink-soft uppercase tracking-wide mb-4">Rate this question</p>

          <div class="space-y-4">
            <div>
              <label class="block font-display text-xs font-semibold text-ink-soft mb-2">Rank</label>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="r in RANKS"
                  :key="r"
                  @click="reviewRank = r"
                  class="font-display px-4 py-2 rounded-xl text-sm font-bold transition-all border-2"
                  :class="reviewRank === r
                    ? [RANK_COLORS[r], 'border-transparent']
                    : 'bg-white border-line text-ink-soft hover:border-cerulean hover:text-cerulean'"
                >
                  {{ r }}
                </button>
              </div>
              <p class="mt-1.5 font-body text-xs text-ink-faint">
                S = best · A/B = good (protected from deletion) · C/D = poor · F = should be deleted
              </p>
            </div>

            <div>
              <label class="block font-display text-xs font-semibold text-ink-soft mb-1">
                Note <span class="text-ink-faint font-normal">(optional)</span>
              </label>
              <input
                v-model="reviewNote"
                type="text"
                placeholder="e.g. distractor 竃く is not a real word"
                class="w-full rounded-xl border border-line px-3 py-2 font-body text-sm text-ink
                       focus:outline-none focus:ring-2 focus:ring-cerulean/40 focus:border-cerulean bg-white"
              />
            </div>

            <div class="flex items-center gap-3">
              <button
                @click="submitReview"
                :disabled="!reviewRank || reviewSubmitting"
                class="btn-primary px-5 py-2 rounded-xl text-sm"
              >
                {{ reviewSubmitting ? 'Submitting…' : 'Submit review' }}
              </button>
              <p v-if="reviewSuccess" class="font-body text-sm text-good">Saved!</p>
              <p v-if="reviewError" class="font-body text-sm text-bad">{{ reviewError }}</p>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="flex justify-center py-20">
        <UiLoadingSpinner />
      </div>
    </div>
  </div>
</template>
