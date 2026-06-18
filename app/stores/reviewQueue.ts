import type { ReviewItem, QuestionResult } from '~/types/index'

const REVIEW_KEY = 'kalima_review_v1'

export const useReviewQueueStore = defineStore('reviewQueue', {
  state: () => ({
    items: [] as ReviewItem[],
  }),

  getters: {
    count: (state): number => state.items.length,
  },

  actions: {
    load() {
      if (!import.meta.client) return
      try {
        const raw = localStorage.getItem(REVIEW_KEY)
        if (raw) this.items = JSON.parse(raw) as ReviewItem[]
      } catch {
        this.items = []
      }
    },

    _persist() {
      if (import.meta.client) {
        localStorage.setItem(REVIEW_KEY, JSON.stringify(this.items))
      }
    },

    addFails(results: QuestionResult[]) {
      const now = Date.now()
      for (const r of results) {
        if (r.correct !== false) continue
        const existing = this.items.find(i => i.wordId === r.wordId && i.type === r.type)
        if (existing) {
          existing.failedAt = now
        } else {
          // For contextual the prompt is a sentence; store the reading for display instead.
          const prompt = r.type === 'contextual' ? (r.reading || r.prompt) : r.prompt
          this.items.push({ wordId: r.wordId, type: r.type, prompt, failedAt: now })
        }
      }
      this._persist()
    },

    removeCorrects(results: QuestionResult[]) {
      for (const r of results) {
        if (r.correct !== true) continue
        const idx = this.items.findIndex(i => i.wordId === r.wordId && i.type === r.type)
        if (idx !== -1) this.items.splice(idx, 1)
      }
      this._persist()
    },

    dequeue(limit = 10): ReviewItem[] {
      return [...this.items]
        .sort((a, b) => a.failedAt - b.failedAt)
        .slice(0, limit)
    },

    clear() {
      this.items = []
      if (import.meta.client) localStorage.removeItem(REVIEW_KEY)
    },
  },
})
