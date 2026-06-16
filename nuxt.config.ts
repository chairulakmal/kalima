import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2026-06-06',

  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  app: {
    head: {
      title: 'Kalima — JLPT N3 Vocabulary Practice',
      htmlAttrs: { lang: 'en' },
      meta: [
        {
          name: 'description',
          content:
            '500 AI-generated JLPT N3 questions across five vocabulary types — kanji reading, writing, context, synonym, and usage. Per-question explanations and Claude-powered session analysis.',
        },
        { name: 'theme-color', content: '#f4a22d', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#1e3a5f', media: '(prefers-color-scheme: dark)' },
        { name: 'apple-mobile-web-app-title', content: 'Kalima' },
        { property: 'og:type',        content: 'website' },
        { property: 'og:site_name',   content: 'Kalima' },
        { property: 'og:title',       content: 'Kalima — JLPT N3 Vocabulary Practice' },
        {
          property: 'og:description',
          content:
            '500 AI-generated JLPT N3 questions with per-question explanations and Claude-powered analysis.',
        },
        { name: 'twitter:card',        content: 'summary' },
        { name: 'twitter:title',       content: 'Kalima — JLPT N3 Vocabulary Practice' },
        {
          name: 'twitter:description',
          content:
            '500 AI-generated JLPT N3 questions with per-question explanations and Claude-powered analysis.',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon',  href: '/favicon.ico' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  modules: ['@pinia/nuxt'],

  vite: {
    plugins: [tailwindcss()],
  },
})
