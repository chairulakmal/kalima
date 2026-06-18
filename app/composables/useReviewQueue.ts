import type { QuestionResult, ReviewItem } from '~/types/index'

export function useReviewQueue() {
  const store = useReviewQueueStore()

  function init() {
    store.load()
  }

  function addFails(results: QuestionResult[]) {
    store.addFails(results)
  }

  function removeCorrects(results: QuestionResult[]) {
    store.removeCorrects(results)
  }

  function getQueueForSession(): ReviewItem[] {
    return store.dequeue(10)
  }

  function clear() {
    store.clear()
  }

  return { store, init, addFails, removeCorrects, getQueueForSession, clear }
}
