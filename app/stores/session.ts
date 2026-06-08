import type { ClientQuestion, Level, SessionMode } from '~/types/index'

export interface SessionCache {
  sessionId: string
  questions: ClientQuestion[]
  level: Level
  type: SessionMode
  startedAt: number
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    sessionId: null as string | null,
    questions: [] as ClientQuestion[],
    level: null as Level | null,
    type: 'synonym' as SessionMode,
    startedAt: null as number | null,
  }),
  actions: {
    set(data: SessionCache) {
      this.sessionId = data.sessionId
      this.questions = data.questions
      this.level = data.level
      this.type = data.type
      this.startedAt = data.startedAt
    },
    reset() {
      this.sessionId = null
      this.questions = []
      this.level = null
      this.type = 'synonym'
      this.startedAt = null
    },
  },
})
