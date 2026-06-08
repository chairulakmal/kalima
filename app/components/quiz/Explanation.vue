<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <p class="font-body text-sm text-ink-soft leading-relaxed">{{ text }}</p>
</template>
