<script setup lang="ts">
definePageMeta({ layout: false })

const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/admin/auth', { method: 'POST', body: { password: password.value } })
    await navigateTo('/admin')
  } catch {
    error.value = 'Invalid password.'
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-paper flex items-center justify-center px-4">
    <div class="w-full max-w-xs">
      <div class="text-center mb-8">
        <h1 class="font-display text-3xl font-bold text-navy tracking-tight mb-1">Kalima</h1>
        <p class="font-body text-sm text-ink-faint">Admin access</p>
      </div>

      <form @submit.prevent="submit" class="bg-white rounded-2xl p-6 border border-line" style="box-shadow: var(--shadow);">
        <label class="block font-display text-xs font-semibold text-ink-soft uppercase tracking-widest mb-2">
          Password
        </label>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          autofocus
          required
          class="w-full px-4 py-2.5 rounded-xl border border-line bg-paper font-body text-navy
                 focus:outline-none focus:border-cerulean transition-colors mb-4"
        />

        <p v-if="error" class="font-body text-sm text-red-500 mb-3">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-xl bg-navy text-white font-display font-semibold text-sm
                 hover:bg-cerulean disabled:opacity-50 transition-colors"
        >
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="text-center mt-6">
        <NuxtLink to="/" class="font-body text-xs text-ink-faint hover:text-cerulean transition-colors">
          ← Back to quiz
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
