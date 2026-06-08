import type { ClientQuestion, Level, SessionMode } from '~/types/index'
import type { SessionCache } from '~/stores/session'

const CACHE_KEY = 'kalima_session_v1'

export function useSession() {
  const store = useSessionStore()

  function save(sessionId: string, questions: ClientQuestion[], level: Level, type: SessionMode) {
    const data: SessionCache = { sessionId, questions, level, type, startedAt: Date.now() }
    store.set(data)
    if (import.meta.client) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    }
  }

  function restore(): boolean {
    if (!import.meta.client) return false
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as SessionCache
      if (!data.type) data.type = 'synonym'
      store.set(data)
      return true
    } catch {
      return false
    }
  }

  function clear() {
    store.reset()
    if (import.meta.client) {
      localStorage.removeItem(CACHE_KEY)
    }
  }

  return { save, restore, clear }
}
