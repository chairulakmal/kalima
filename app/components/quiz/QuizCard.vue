<script setup lang="ts">
import type { QuestionType } from '~/types/index'

const props = defineProps<{
  prompt: string
  context?: string
  type: QuestionType
}>()

const INSTRUCTIONS: Record<QuestionType, string> = {
  reading:     '＿＿のことばの読み方として最もよいものを、１・２・３・４から一つえらびなさい。',
  orthography: '＿＿のことばを漢字で書くとき、最もよいものを、１・２・３・４から一つえらびなさい。',
  contextual:  '（　　）に入れるのに最もよいものを、１・２・３・４から一つえらびなさい。',
  synonym:     '＿＿のことばに意味が最も近いものを、１・２・３・４から一つえらびなさい。',
  usage:       'つぎのことばの使い方として最もよいものを、１・２・３・４から一つえらびなさい。',
}
const instruction = computed(() => INSTRUCTIONS[props.type])

// For contextual, split prompt on （　　） so we can highlight the blank.
const contextualParts = computed(() => {
  if (props.type !== 'contextual') return null
  const idx = props.prompt.indexOf('（　　）')
  if (idx === -1) return null
  return {
    before: props.prompt.slice(0, idx),
    after: props.prompt.slice(idx + 5), // （　　） is 5 chars
  }
})

const sentenceParts = computed(() => {
  if (!props.context) return null

  let searchTerm = props.prompt
  let idx = props.context.indexOf(searchTerm)

  if (idx === -1) {
    const stem = props.prompt.replace(/[぀-ゟ]+$/, '')
    if (stem.length > 0 && stem !== props.prompt) {
      const stemIdx = props.context.indexOf(stem)
      if (stemIdx !== -1) { idx = stemIdx; searchTerm = stem }
    }
  }

  if (idx === -1 && /^[ぁ-んァ-ン]+$/.test(props.prompt)) {
    const minLen = Math.max(2, Math.ceil(props.prompt.length / 2))
    for (let len = props.prompt.length - 1; len >= minLen; len--) {
      const prefix = props.prompt.slice(0, len)
      const prefixIdx = props.context.indexOf(prefix)
      if (prefixIdx !== -1) { idx = prefixIdx; searchTerm = prefix; break }
    }
  }

  if (idx === -1) return null
  return {
    before: props.context.slice(0, idx),
    word: searchTerm,
    after: props.context.slice(idx + searchTerm.length),
  }
})
</script>

<template>
  <div>
    <!-- JLPT instruction -->
    <p class="font-jp text-xs text-ink-faint mb-5 leading-relaxed">
      {{ instruction }}
    </p>

    <!-- 問題3 文脈規定: sentence with highlighted blank -->
    <template v-if="type === 'contextual'">
      <p v-if="contextualParts" class="font-jp text-xl text-ink leading-relaxed text-left">
        {{ contextualParts.before }}<span
          class="font-bold text-cerulean"
        >（　　）</span>{{ contextualParts.after }}
      </p>
      <p v-else class="font-jp text-xl text-ink leading-relaxed text-left">{{ prompt }}</p>
    </template>

    <!-- All other types: sentence with underlined target word -->
    <template v-else-if="context">
      <p v-if="sentenceParts" class="font-jp text-xl text-ink leading-relaxed text-left">
        {{ sentenceParts.before }}<span
          class="font-bold underline decoration-2 decoration-cerulean underline-offset-4"
        >{{ sentenceParts.word }}</span>{{ sentenceParts.after }}
      </p>
      <!-- fallback: conjugated form not literally in sentence -->
      <div v-else class="text-left">
        <p class="font-jp text-xl text-ink leading-relaxed mb-3">{{ context }}</p>
        <p class="font-jp text-4xl font-bold text-navy">{{ prompt }}</p>
      </div>
    </template>

    <!-- No example sentence: show word alone -->
    <p v-else class="font-jp text-5xl font-bold text-navy leading-tight">{{ prompt }}</p>
  </div>
</template>
