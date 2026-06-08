<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; message: string } }>()

const title = computed(() =>
  props.error.statusCode === 404 ? 'Page not found' : 'Something went wrong',
)

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="min-h-screen bg-paper flex flex-col items-center justify-center p-4">
    <div class="max-w-sm w-full text-center">
      <p class="font-display font-bold text-8xl text-line mb-4 select-none leading-none">
        {{ error.statusCode }}
      </p>
      <h1 class="font-display text-xl font-bold text-navy mb-2">{{ title }}</h1>
      <p class="font-body text-sm text-ink-soft mb-8 leading-relaxed">{{ error.message }}</p>
      <button class="btn-primary px-6 py-2.5 rounded-2xl text-sm" @click="goHome">
        Go home
      </button>
    </div>
  </div>
</template>
