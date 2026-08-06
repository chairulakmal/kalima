// The one live Anthropic call in the app. It is budget-capped server-side, so a
// failure here is an expected outcome rather than an error to surface: the caller
// renders a quota notice and the results below it stand on their own.
export function useSessionAnalysis() {
  const analysis = ref<string | null>(null)
  const loading = ref(false)

  async function fetchAnalysis(sessionId: string) {
    loading.value = true
    try {
      const res = await $fetch<{ analysis: string }>('/api/session/analysis', {
        method: 'POST',
        body: { sessionId },
      })
      analysis.value = res.analysis
    } catch {
      analysis.value = null
    } finally {
      loading.value = false
    }
  }

  return { analysis, loading, fetchAnalysis }
}
