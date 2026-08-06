import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    // Tests live outside server/ so Nitro's auto-import scan never picks them up.
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
