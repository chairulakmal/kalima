<script setup lang="ts">
import type { ClientQuestion, Level, SessionMode } from '~/types/index'

useHead({ title: 'Getting ready… · Kalima' })

const route = useRoute()
const router = useRouter()
const session = useSession()
const errorMsg = ref<string | null>(null)

const phrases = [
  '問題を準備しています…',
  'Opening the book…',
  '選択中…',
  'Almost ready…',
  'もうすぐです…',
]
const phraseIndex = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  interval = setInterval(() => {
    phraseIndex.value = (phraseIndex.value + 1) % phrases.length
  }, 1800)

  const level = route.query.level as string
  const validModes: SessionMode[] = ['reading', 'orthography', 'contextual', 'synonym', 'usage', 'vocab']
  const type: SessionMode = validModes.includes(route.query.type as SessionMode)
    ? (route.query.type as SessionMode)
    : 'synonym'
  if (!level) { router.replace('/'); return }

  try {
    const [result] = await Promise.all([
      $fetch<{ sessionId: string; questions: ClientQuestion[] }>(
        '/api/session/prepare',
        { method: 'POST', body: { level, type } },
      ),
      new Promise<void>(resolve => setTimeout(resolve, 1000)),
    ])
    session.save(result.sessionId, result.questions, level as Level, type)
    router.replace('/quiz')
  } catch {
    errorMsg.value = 'Failed to load the quiz. Please try again.'
  }
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <div class="min-h-screen bg-paper flex flex-col items-center justify-center gap-8 p-4">
    <template v-if="errorMsg">
      <p class="text-bad text-sm font-body">{{ errorMsg }}</p>
      <NuxtLink to="/" class="text-cerulean text-sm underline font-body">Go back</NuxtLink>
    </template>

    <template v-else>
      <!-- Bun — "Open" expression (home / new session) -->
      <div class="bun-float select-none" aria-label="Bun the mascot" role="img">
        <svg viewBox="0 0 100 130" width="130" height="169" xmlns="http://www.w3.org/2000/svg" fill="none">
          <!-- Pages layer — cream, fan out right of cover -->
          <rect x="13" y="3" width="79" height="124" rx="5" fill="#f9f5ea"/>
          <rect x="10" y="4" width="79" height="122" rx="5" fill="#f3edd6"/>

          <!-- Front cover (Scholar Navy) -->
          <rect x="5" y="5" width="76" height="118" rx="8" fill="#1e3a5f"/>

          <!-- Gold spine -->
          <rect x="5" y="5" width="14" height="118" rx="7" fill="#f4a22d"/>
          <!-- Spine sheen -->
          <rect x="7" y="11" width="5" height="106" rx="2.5" fill="rgba(255,255,255,0.22)"/>

          <!-- Corner guards (Achievement Gold) -->
          <rect x="69" y="5"   width="12" height="12" rx="3" fill="#f4a22d"/>
          <rect x="5"  y="111" width="12" height="12" rx="3" fill="#f4a22d"/>
          <rect x="69" y="111" width="12" height="12" rx="3" fill="#f4a22d"/>

          <!-- Decorative title lines on cover -->
          <rect x="24" y="19" width="44" height="3" rx="1.5" fill="rgba(255,255,255,0.13)"/>
          <rect x="28" y="26" width="33" height="2" rx="1"   fill="rgba(255,255,255,0.07)"/>

          <!-- Left eye (bright, slightly upward gaze = "Open" expression) -->
          <g class="bun-eye-left">
            <circle cx="36" cy="63" r="12" fill="white"/>
            <circle cx="36" cy="60" r="7"  fill="#1e3a5f"/>
            <circle cx="41" cy="55" r="2.5" fill="white"/>
          </g>

          <!-- Right eye -->
          <g class="bun-eye-right">
            <circle cx="64" cy="63" r="12" fill="white"/>
            <circle cx="64" cy="60" r="7"  fill="#1e3a5f"/>
            <circle cx="69" cy="55" r="2.5" fill="white"/>
          </g>

          <!-- Smile -->
          <path
d="M 33 79 Q 50 89 67 79"
                stroke="rgba(255,255,255,0.38)"
                stroke-width="2.5"
                stroke-linecap="round"/>

          <!-- Bookmark ribbon (gold chevron, top-right — covers corner guard) -->
          <polygon points="69,5 81,5 81,32 75,25 69,32" fill="#f4a22d"/>
        </svg>
      </div>

      <!-- Cycling phrase -->
      <Transition name="phrase" mode="out-in">
        <p :key="phraseIndex" class="text-sm text-ink-soft font-jp tracking-wide">
          {{ phrases[phraseIndex] }}
        </p>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
/* Bun float */
.bun-float {
  animation: bun-float 2.8s ease-in-out infinite;
}
@keyframes bun-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-12px); }
}

/* Eye blink */
.bun-eye-left,
.bun-eye-right {
  transform-box: fill-box;
  transform-origin: center;
  animation: bun-blink 5s ease-in-out infinite;
}
.bun-eye-right {
  animation-delay: 0.07s;
}
@keyframes bun-blink {
  0%, 85%, 100% { transform: scaleY(1); }
  91%           { transform: scaleY(0.06); }
}

/* Phrase crossfade */
.phrase-enter-active,
.phrase-leave-active {
  transition: opacity 0.4s ease;
}
.phrase-enter-from,
.phrase-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .bun-float,
  .bun-eye-left,
  .bun-eye-right {
    animation: none;
  }
}
</style>
