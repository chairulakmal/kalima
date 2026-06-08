<script setup lang="ts">
defineProps<{ current: number; total: number }>()
</script>

<template>
  <div class="w-full h-1.5 rounded-full" style="background-color: var(--sky);">
    <div
      class="h-1.5 rounded-full bg-navy transition-all duration-300"
      :style="{ width: `${Math.min((current / total) * 100, 100)}%` }"
    />
  </div>
</template>
