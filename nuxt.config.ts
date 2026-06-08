import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2026-06-06',

  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  css: ['~/assets/css/main.css'],

  modules: ['@pinia/nuxt'],

  vite: {
    plugins: [tailwindcss()],
  },
})
