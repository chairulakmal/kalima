<script setup lang="ts">
import type { SessionMode } from '~/types/index'

const session = useSession()
onMounted(() => session.clear())

const vocabTypes: { mode: SessionMode; num: string; jp: string; en: string }[] = [
  { mode: 'reading',    num: '問題１', jp: '漢字読み',    en: 'Kanji Reading' },
  { mode: 'orthography',num: '問題２', jp: '表記',        en: 'Kanji Writing' },
  { mode: 'contextual', num: '問題３', jp: '文脈規定',    en: 'Contextual Fill-in' },
  { mode: 'synonym',    num: '問題４', jp: '言い換え類義', en: 'Synonym' },
  { mode: 'usage',      num: '問題５', jp: '用法',        en: 'Correct Usage' },
]

const upcomingSections = [
  { jp: '読解', en: 'Reading',  version: 'V2' },
  { jp: '文法', en: 'Grammar',  version: 'V3' },
]
</script>

<template>
  <div class="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm">

      <!-- Wordmark -->
      <div class="text-center mb-8">
        <h1 class="font-display text-5xl font-bold text-navy tracking-tight mb-1">Kalima</h1>
        <p class="font-jp text-lg text-ink-faint mb-3">كلمة</p>
        <div class="flex items-center justify-center gap-1.5">
          <span
            v-for="lvl in ['N5','N4','N3','N2','N1']"
            :key="lvl"
            :class="lvl === 'N3'
              ? 'bg-navy text-white'
              : 'bg-line text-ink-faint opacity-50 cursor-default'"
            class="inline-block text-xs font-display font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full"
          >{{ lvl }}</span>
        </div>
      </div>

      <!-- Section cards -->
      <div class="space-y-3 mb-6">

        <!-- Vocabulary — primary card with nested sub-types -->
        <div
class="bg-white rounded-2xl border border-line border-l-[3px] border-l-cerulean overflow-hidden"
             style="box-shadow: var(--shadow);">

          <!-- Full-section link -->
          <NuxtLink
            to="/loading?level=N3&type=vocab"
            class="group flex items-start justify-between gap-3 px-5 pt-4 pb-4 hover:bg-paper transition-colors"
          >
            <div>
              <div class="flex items-baseline gap-2 mb-0.5">
                <span class="font-display text-xs font-semibold text-cerulean">全問</span>
                <span class="font-jp text-xl font-bold text-navy">文字・語彙</span>
              </div>
              <p class="font-body text-xs text-ink-faint">
                問題1–5 in order · 35 questions · 30 min
              </p>
            </div>
            <span
class="font-display text-xs font-semibold text-ink-faint
                         group-hover:text-cerulean transition-colors whitespace-nowrap pt-0.5">
              Full section →
            </span>
          </NuxtLink>

          <!-- Sub-type grid: 2 columns, hairline borders via gap-px -->
          <div class="border-t border-line" />
          <div class="grid grid-cols-2 gap-px bg-line m-px rounded-b-2xl overflow-hidden">
            <NuxtLink
              v-for="t in vocabTypes"
              :key="t.mode"
              :to="`/loading?level=N3&type=${t.mode}`"
              class="group flex items-center justify-between bg-white px-4 py-3
                     hover:bg-paper transition-colors last:col-span-2"
            >
              <div>
                <p class="font-display text-xs font-semibold text-ink-faint leading-none mb-0.5">{{ t.num }}</p>
                <p class="font-jp text-sm font-bold text-navy leading-tight">{{ t.jp }}</p>
              </div>
              <span class="font-display text-xs text-ink-faint group-hover:text-cerulean transition-colors">→</span>
            </NuxtLink>
          </div>
        </div>

        <!-- Upcoming sections — compact placeholder cards -->
        <div
          v-for="s in upcomingSections"
          :key="s.en"
          class="bg-white rounded-2xl border border-line border-l-[3px] border-l-line px-5 py-3.5
                 flex items-center justify-between opacity-50"
          style="box-shadow: var(--shadow);"
        >
          <div class="flex items-baseline gap-2">
            <span class="font-jp text-xl font-bold text-navy">{{ s.jp }}</span>
            <span class="font-display text-xs font-semibold text-ink-faint">{{ s.en }}</span>
          </div>
          <span class="font-display text-xs font-semibold px-2.5 py-1 rounded-full bg-line text-ink-faint">
            {{ s.version }}
          </span>
        </div>
      </div>

      <p class="text-center text-xs text-ink-faint font-body leading-relaxed">
        500 AI-generated questions · schema-validated distractors<br>
        Claude Sonnet-powered analysis · modelled on official JLPT N3 guides
      </p>

      <div class="flex items-center justify-center gap-1.5 mt-3 opacity-60">
        <!-- Vue logo -->
        <img src="/vue.svg" width="14" height="12" alt="Vue logo" >
        <span class="text-xs font-body text-ink-faint">Full-stack Vue · Nuxt 4</span>
        <!-- Nuxt logo -->
        <img src="/nuxt.svg" width="22" height="22" alt="Nuxt logo" >
      </div>
    </div>
  </div>
</template>
