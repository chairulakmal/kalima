<script setup lang="ts">
definePageMeta({ ssr: false })

const RANK_OPTIONS = ['S', 'A', 'B', 'C', 'D', 'F', 'unranked'] as const
type RankFilter = (typeof RANK_OPTIONS)[number] | null

const DELETABLE_RANKS = new Set(['C', 'D', 'F'])

const RANK_COLORS: Record<string, string> = {
  S: 'bg-yellow-400 text-yellow-900',
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-orange-400 text-white',
  D: 'bg-red-400 text-white',
  F: 'bg-red-700 text-white',
}

const TYPE_LABELS: Record<string, string> = {
  reading: '漢字読み',
  orthography: '表記',
  contextual: '文脈規定',
  synonym: '言い換え類義',
  usage: '用法',
}

interface AdminQuestion {
  id: string
  wordId: string
  type: string
  model: string
  explanation: string
  version: number
  createdAt: string
  reviewCount: number
  effectiveRank: string | null
  deletable: boolean
}

interface AdminResponse {
  questions: AdminQuestion[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  rankFilter: string | null
}

const page = ref(1)
const rankFilter = ref<RankFilter>(null)

const { data, refresh, pending } = useLazyAsyncData<AdminResponse>(
  () => `admin-questions-${page.value}-${rankFilter.value}`,
  () => $fetch('/api/admin/questions', {
    query: { page: page.value, ...(rankFilter.value ? { rank: rankFilter.value } : {}) },
  }),
  { watch: [page, rankFilter] },
)

function setRank(r: RankFilter) {
  rankFilter.value = r
  page.value = 1
}

function modelLabel(model: string): string {
  if (model === 'fallback') return 'Fallback'
  if (model.includes('haiku-4-5')) return 'Haiku 4.5'
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('sonnet-4')) return 'Sonnet 4'
  if (model.includes('opus-4')) return 'Opus 4'
  return model
}

function rankLabel(rank: string | null): string {
  return rank ?? '—'
}

function rankClass(rank: string | null): string {
  return rank ? RANK_COLORS[rank] ?? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-400'
}

const bulkDeleting = ref(false)
async function bulkDelete() {
  const label = rankFilter.value === 'unranked' ? 'unranked' : `rank ${rankFilter.value}`
  const count = data.value?.total ?? 0
  if (!confirm(`Delete all ${count} ${label} questions? This cannot be undone.`)) return
  bulkDeleting.value = true
  try {
    const { deleted } = await $fetch<{ deleted: number }>('/api/admin/questions/bulk-delete', {
      method: 'POST',
      body: { rank: rankFilter.value === 'unranked' ? null : rankFilter.value },
    })
    alert(`Deleted ${deleted} question${deleted === 1 ? '' : 's'}.`)
    await refresh()
  } catch (e: unknown) {
    alert((e as { data?: { message?: string } })?.data?.message ?? 'Delete failed.')
  } finally {
    bulkDeleting.value = false
  }
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await navigateTo('/admin/login')
}

const deletingId = ref<string | null>(null)
async function deleteOne(q: AdminQuestion, event: MouseEvent) {
  event.stopPropagation()
  if (!confirm(`Delete this ${q.type} question? This cannot be undone.`)) return
  deletingId.value = q.id
  try {
    await $fetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: unknown) {
    alert((e as { data?: { message?: string } })?.data?.message ?? 'Delete failed.')
  } finally {
    deletingId.value = null
  }
}

const canBulkDelete = computed(
  () => rankFilter.value !== null && DELETABLE_RANKS.has(rankFilter.value) && (data.value?.total ?? 0) > 0,
)
</script>

<template>
  <div class="min-h-screen bg-paper py-8 px-4">
    <div class="max-w-5xl mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="font-display text-2xl font-bold text-navy">Exam Questions</h1>
          <p class="font-body text-sm text-ink-soft mt-0.5">
            {{ data?.total ?? 0 }} {{ rankFilter ? (rankFilter === 'unranked' ? 'unranked' : `rank ${rankFilter}`) : 'total' }}
            <template v-if="data && data.totalPages > 1">
              · page {{ data.page }} of {{ data.totalPages }}
            </template>
          </p>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="refresh()"
            :disabled="pending"
            class="font-display text-sm font-semibold text-cerulean hover:text-navy disabled:opacity-40 transition-colors"
          >
            Refresh
          </button>
          <button
            @click="logout()"
            class="font-display text-sm font-semibold text-ink-faint hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <!-- Rank filter -->
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          @click="setRank(null)"
          class="font-display px-3 py-1 rounded-full text-xs font-semibold transition-colors"
          :class="rankFilter === null
            ? 'bg-navy text-white'
            : 'bg-white border border-line text-ink-soft hover:border-cerulean hover:text-cerulean'"
        >
          All
        </button>
        <button
          v-for="r in RANK_OPTIONS"
          :key="r"
          @click="setRank(r)"
          class="font-display px-3 py-1 rounded-full text-xs font-semibold transition-colors"
          :class="rankFilter === r
            ? (r === 'unranked' ? 'bg-ink-faint text-white' : RANK_COLORS[r])
            : 'bg-white border border-line text-ink-soft hover:border-cerulean hover:text-cerulean'"
        >
          {{ r === 'unranked' ? 'Unranked' : r }}
        </button>
      </div>

      <!-- Bulk delete -->
      <div v-if="canBulkDelete" class="mb-4">
        <button
          @click="bulkDelete"
          :disabled="bulkDeleting"
          class="font-display px-4 py-2 text-sm font-semibold rounded-xl bg-bad text-white
                 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {{ bulkDeleting ? 'Deleting…' : `Delete all ${rankFilter === 'unranked' ? 'unranked' : 'rank ' + rankFilter} (${data?.total ?? 0})` }}
        </button>
      </div>

      <div v-if="pending" class="flex justify-center py-20">
        <UiLoadingSpinner />
      </div>

      <template v-else-if="data?.questions.length">
        <div class="bg-white rounded-2xl overflow-hidden mb-4" style="box-shadow: var(--shadow);">
          <table class="w-full text-sm">
            <thead class="bg-paper border-b border-line">
              <tr>
                <th class="px-4 py-3 text-left font-display text-xs font-semibold text-ink-faint uppercase tracking-wide">Word ID</th>
                <th class="px-4 py-3 text-left font-display text-xs font-semibold text-ink-faint uppercase tracking-wide">Type</th>
                <th class="px-4 py-3 text-left font-display text-xs font-semibold text-ink-faint uppercase tracking-wide">Rank</th>
                <th class="px-4 py-3 text-left font-display text-xs font-semibold text-ink-faint uppercase tracking-wide">Model</th>
                <th class="px-4 py-3 text-left font-display text-xs font-semibold text-ink-faint uppercase tracking-wide">Explanation</th>
                <th class="px-4 py-3 text-left font-display text-xs font-semibold text-ink-faint uppercase tracking-wide">Created</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr
                v-for="q in data.questions"
                :key="q.id"
                class="hover:bg-paper transition-colors cursor-pointer"
                @click="navigateTo(`/admin/${q.id}`)"
              >
                <td class="px-4 py-3 font-mono text-xs text-ink-faint">{{ q.wordId.slice(0, 12) }}…</td>
                <td class="px-4 py-3">
                  <span class="font-jp inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-line text-ink-soft">
                    {{ TYPE_LABELS[q.type] ?? q.type }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="font-display inline-block text-xs font-bold px-2 py-0.5 rounded-full"
                    :class="rankClass(q.effectiveRank)"
                  >
                    {{ rankLabel(q.effectiveRank) }}
                    <template v-if="q.reviewCount > 0">
                      <span class="opacity-60 font-normal">({{ q.reviewCount }})</span>
                    </template>
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="font-display inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                    :class="q.model === 'seed' ? 'bg-surface-cool text-cerulean'
                           : q.model === 'fallback' ? 'bg-warn/10 text-warn'
                           : 'bg-surface-cool text-cerulean'"
                  >
                    {{ modelLabel(q.model) }}
                  </span>
                </td>
                <td class="px-4 py-3 font-body text-ink-soft max-w-xs truncate">{{ q.explanation }}</td>
                <td class="px-4 py-3 font-body text-ink-faint text-xs whitespace-nowrap">
                  {{ new Date(q.createdAt).toLocaleDateString() }}
                </td>
                <td class="px-4 py-3">
                  <button
                    v-if="q.deletable"
                    @click="deleteOne(q, $event)"
                    :disabled="deletingId === q.id"
                    class="font-display text-xs font-semibold text-bad hover:text-bad/70
                           disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {{ deletingId === q.id ? '…' : 'Delete' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="data.totalPages > 1" class="flex items-center justify-between">
          <button
            :disabled="page === 1"
            @click="page--"
            class="btn-secondary px-4 py-2 text-sm rounded-xl disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span class="font-display text-sm text-ink-soft">{{ page }} / {{ data.totalPages }}</span>
          <button
            :disabled="page === data.totalPages"
            @click="page++"
            class="btn-secondary px-4 py-2 text-sm rounded-xl disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </template>

      <p v-else class="text-center font-body text-ink-faint py-20">
        {{ rankFilter ? 'No questions with this rank.' : 'No generated questions yet.' }}
      </p>
    </div>
  </div>
</template>
