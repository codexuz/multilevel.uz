<script setup lang="ts">
/**
 * A round of word games, in the manner of a language app: a thick progress bar along the top, one
 * question at a time with big tiles, and a bar at the bottom that turns green or red with the right
 * answer and a Continue button. A new word is introduced first; then it is asked as its meaning,
 * the word for a meaning, typing it, listening and spelling it, or matching five pairs. A missed
 * card comes back once at the end. The round ends on its XP and accuracy.
 *
 * The page gives the cards (and a pool for wrong options) and is told each answer (`answer`) and
 * the end (`finish`); it passes back the XP earned to show. Keys: 1–4 pick, Enter checks and goes on.
 */
export interface GameCard {
  id: string
  term: string
  definition: string
  translation?: string | null
  example?: string | null
  ipa?: string | null
  partOfSpeech?: string | null
  isNew?: boolean
}
type Step
  = | { kind: 'learn', card: GameCard }
    | { kind: 'meaning', card: GameCard, options: string[], answer: string }
    | { kind: 'reverse', card: GameCard, options: string[], answer: string }
    | { kind: 'type', card: GameCard }
    | { kind: 'listen', card: GameCard }
    | { kind: 'match', cards: GameCard[] }

const props = defineProps<{ cards: GameCard[], pool?: GameCard[], title: string, closeTo: string, xpEarned?: number | null }>()
const emit = defineEmits<{ answer: [cardId: string, correct: boolean], finish: [results: { cardId: string, correct: boolean }[]], again: [] }>()
const { t } = useI18n()

// ---- building the round ----
function shuffle<T>(a: T[]) {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j]!, b[i]!]
  }
  return b
}
const canSpeak = ref(false)
const meaningOf = (c: GameCard) => c.translation || c.definition
function optionsFor(card: GameCard, key: (c: GameCard) => string) {
  const others = shuffle([...(props.pool ?? []), ...props.cards].filter(c => c.id !== card.id && key(c) && key(c) !== key(card)))
  const seen = new Set<string>([key(card)])
  const picked: string[] = []
  for (const o of others) {
    if (picked.length >= 3) break
    if (!seen.has(key(o))) {
      seen.add(key(o))
      picked.push(key(o))
    }
  }
  return shuffle([key(card), ...picked])
}
function questionFor(card: GameCard, avoid?: Step['kind']): Step {
  const kinds: Step['kind'][] = ['meaning', 'reverse', 'type', ...(canSpeak.value ? ['listen' as const] : [])]
  const choices = kinds.filter(k => k !== avoid)
  const kind = choices[Math.floor(Math.random() * choices.length)]!
  if (kind === 'meaning') return { kind, card, options: optionsFor(card, c => c.definition), answer: card.definition }
  if (kind === 'reverse') return { kind, card, options: optionsFor(card, c => c.term), answer: card.term }
  return { kind, card } as Step
}
function build(): Step[] {
  const steps: Step[] = []
  for (const c of props.cards) {
    if (c.isNew) steps.push({ kind: 'learn', card: c }, { kind: 'meaning', card: c, options: optionsFor(c, x => x.definition), answer: c.definition })
    else steps.push(questionFor(c))
  }
  const learned = shuffle(steps.filter(s => s.kind !== 'learn'))
  // Learn-then-ask pairs stay together; the rest are mixed in between.
  const out: Step[] = []
  for (const s of steps) if (s.kind === 'learn') out.push(s, steps[steps.indexOf(s) + 1]!)
  for (const s of learned) if (!out.includes(s)) out.push(s)
  if (props.cards.length >= 4) out.push({ kind: 'match', cards: shuffle(props.cards).slice(0, 5) })
  return out
}

const steps = ref<Step[]>([])
const at = ref(0)
const results = ref<{ cardId: string, correct: boolean }[]>([])
const retried = new Set<string>()
const combo = ref(0)
const bestCombo = ref(0)
const startedAt = ref(Date.now())
onMounted(() => {
  canSpeak.value = 'speechSynthesis' in window
  steps.value = build()
  startedAt.value = Date.now()
})
watch(() => props.cards, () => {
  steps.value = build()
  at.value = 0
  results.value = []
  retried.clear()
  combo.value = 0
  finished.value = false
  reset()
})

const step = computed(() => steps.value[at.value] ?? null)
const finished = ref(false)
const answeredCount = computed(() => results.value.length)
const progress = computed(() => (steps.value.length ? Math.round(at.value / steps.value.length * 100) : 0))

// ---- answering ----
const picked = ref<string | null>(null)
const typed = ref('')
const verdict = ref<'right' | 'close' | 'wrong' | null>(null)
const input = ref<{ inputRef?: HTMLInputElement } | null>(null)
function reset() {
  picked.value = null
  typed.value = ''
  verdict.value = null
  matchLeft.value = null
  matched.value = new Set()
  matchMiss.value = new Set()
  wrongFlash.value = null
  nextTick(() => {
    input.value?.inputRef?.focus()
    if (step.value?.kind === 'listen') speak(step.value.card.term)
  })
}
const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[’']/g, '\'').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()
function distance(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[b.length]!
}
const canCheck = computed(() => {
  const s = step.value
  if (!s || verdict.value) return false
  if (s.kind === 'meaning' || s.kind === 'reverse') return !!picked.value
  if (s.kind === 'type' || s.kind === 'listen') return !!typed.value.trim()
  return false
})
function record(cardId: string, ok: boolean) {
  results.value.push({ cardId, correct: ok })
  emit('answer', cardId, ok)
}
function judge(ok: boolean, close = false) {
  const s = step.value!
  verdict.value = ok ? (close ? 'close' : 'right') : 'wrong'
  combo.value = ok ? combo.value + 1 : 0
  bestCombo.value = Math.max(bestCombo.value, combo.value)
  if (s.kind !== 'learn' && s.kind !== 'match') {
    record(s.card.id, ok)
    // A miss comes back once, asked another way, at the end of the round.
    if (!ok && !retried.has(s.card.id)) {
      retried.add(s.card.id)
      steps.value.push(questionFor(s.card, s.kind))
    }
  }
}
function check() {
  const s = step.value
  if (!s || !canCheck.value) return
  if (s.kind === 'meaning' || s.kind === 'reverse') return judge(picked.value === s.answer)
  if (s.kind === 'type' || s.kind === 'listen') {
    const a = norm(typed.value)
    const b = norm(s.card.term)
    if (a === b) return judge(true)
    return judge(b.length > 4 && distance(a, b) === 1, true)
  }
}
function next() {
  if (at.value + 1 >= steps.value.length) {
    finished.value = true
    emit('finish', results.value)
    return
  }
  at.value++
  reset()
}
function onEnter() {
  const s = step.value
  if (!s || finished.value) return
  if (s.kind === 'learn' || verdict.value) return next()
  if (canCheck.value) check()
}
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.tagName === 'INPUT' && e.key !== 'Enter') return
  if (e.key === 'Enter') {
    e.preventDefault()
    onEnter()
  } else if (/^[1-4]$/.test(e.key) && step.value && (step.value.kind === 'meaning' || step.value.kind === 'reverse') && !verdict.value) {
    picked.value = step.value.options[Number(e.key) - 1] ?? null
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (canSpeak.value) window.speechSynthesis.cancel()
})

// ---- matching pairs ----
const matchLeft = ref<string | null>(null)
const matched = ref(new Set<string>())
const matchMiss = ref(new Set<string>())
const wrongFlash = ref<string | null>(null)
const rightCol = computed(() => (step.value?.kind === 'match' ? shuffle(step.value.cards) : []))
function pickRight(card: GameCard) {
  const s = step.value
  if (s?.kind !== 'match' || !matchLeft.value || matched.value.has(card.id)) return
  if (matchLeft.value === card.id) {
    matched.value = new Set([...matched.value, card.id])
    matchLeft.value = null
    if (matched.value.size === s.cards.length) {
      for (const c of s.cards) record(c.id, !matchMiss.value.has(c.id))
      verdict.value = matchMiss.value.size ? 'close' : 'right'
      combo.value = matchMiss.value.size ? 0 : combo.value + 1
    }
  } else {
    matchMiss.value = new Set([...matchMiss.value, matchLeft.value, card.id])
    wrongFlash.value = card.id
    setTimeout(() => (wrongFlash.value = null), 450)
    matchLeft.value = null
  }
}

// ---- sound ----
function speak(text: string, slow = false) {
  if (!canSpeak.value) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-GB'
  u.rate = slow ? 0.6 : 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

// ---- the end ----
const right = computed(() => results.value.filter(r => r.correct).length)
const accuracy = computed(() => (answeredCount.value ? Math.round(right.value / answeredCount.value * 100) : 100))
const minutes = computed(() => Math.max(1, Math.round((Date.now() - startedAt.value) / 60_000)))
const prompt = computed(() => {
  const s = step.value
  if (!s) return ''
  return {
    learn: t('game.newWord'),
    meaning: t('game.pickMeaning'),
    reverse: t('game.pickWord'),
    type: t('game.typeWord'),
    listen: t('game.listenType'),
    match: t('game.matchPairs')
  }[s.kind]
})
const exampleWithGap = (c: GameCard) => {
  if (!c.example) return null
  const re = new RegExp(c.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  return re.test(c.example) ? c.example.replace(re, '_____') : null
}
const praise = computed(() => [t('game.praise1'), t('game.praise2'), t('game.praise3'), t('game.praise4')][at.value % 4])
</script>

<template>
  <div
    class="min-h-dvh flex flex-col bg-default"
    data-testid="game"
  >
    <!-- The bar along the top: leave, progress, streak of right answers -->
    <header class="mx-auto w-full max-w-3xl flex items-center gap-3 sm:gap-4 px-4 pt-4 sm:pt-8">
      <UButton
        :to="closeTo"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="lg"
        :aria-label="t('game.leave')"
      />
      <div
        class="flex-1 h-4 rounded-full bg-accented/70 overflow-hidden"
        role="progressbar"
        :aria-valuenow="finished ? 100 : progress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="relative h-full rounded-full bg-correct transition-[width] duration-500 ease-out"
          :style="{ width: `${finished ? 100 : Math.max(4, progress)}%` }"
        >
          <span class="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
        </div>
      </div>
      <span
        class="flex items-center gap-0.5 font-extrabold tabular-nums min-w-10"
        :class="combo >= 2 ? 'text-flame' : 'text-dimmed'"
        :title="t('game.inARow', { n: combo })"
      >
        <UIcon
          name="i-lucide-flame"
          class="size-5"
        />{{ combo }}
      </span>
    </header>

    <!-- The end of the round -->
    <main
      v-if="finished"
      class="flex-1 mx-auto w-full max-w-xl px-4 py-10 flex flex-col items-center text-center gap-6"
      data-testid="game-end"
    >
      <div class="grid place-items-center size-28 rounded-full bg-xp/15 text-xp">
        <UIcon
          name="i-lucide-trophy"
          class="size-16"
        />
      </div>
      <div>
        <h1 class="text-3xl font-extrabold text-highlighted">
          {{ accuracy >= 80 ? t('game.greatRound') : t('game.roundDone') }}
        </h1>
        <p class="text-muted mt-1">
          {{ title }}
        </p>
      </div>
      <div class="grid grid-cols-3 gap-3 w-full">
        <div class="rounded-xl border-2 border-xp overflow-hidden">
          <p class="bg-xp text-white text-xs font-extrabold uppercase py-1">
            {{ t('game.totalXp') }}
          </p>
          <p class="py-3 text-2xl font-extrabold text-xp flex items-center justify-center gap-1">
            <UIcon
              name="i-lucide-zap"
              class="size-6"
            />
            <USkeleton
              v-if="xpEarned == null"
              class="h-7 w-8"
            />
            <template v-else>
              {{ xpEarned }}
            </template>
          </p>
        </div>
        <div class="rounded-xl border-2 border-correct overflow-hidden">
          <p class="bg-correct text-white text-xs font-extrabold uppercase py-1">
            {{ t('game.accuracy') }}
          </p>
          <p class="py-3 text-2xl font-extrabold text-correct tabular-nums">
            {{ accuracy }}%
          </p>
        </div>
        <div class="rounded-xl border-2 border-primary overflow-hidden">
          <p class="bg-primary text-white text-xs font-extrabold uppercase py-1">
            {{ t('game.bestStreak') }}
          </p>
          <p class="py-3 text-2xl font-extrabold text-primary tabular-nums flex items-center justify-center gap-1">
            <UIcon
              name="i-lucide-flame"
              class="size-6"
            />{{ bestCombo }}
          </p>
        </div>
      </div>
      <p class="text-sm text-muted">
        {{ t('game.summary', { right, total: answeredCount, min: minutes }) }}
      </p>
      <div class="flex flex-col sm:flex-row gap-3 w-full mt-2">
        <UButton
          :to="closeTo"
          :label="t('game.done')"
          color="neutral"
          variant="outline"
          size="xl"
          block
          class="sm:flex-1"
        />
        <UButton
          :label="t('game.again')"
          icon="i-lucide-rotate-ccw"
          size="xl"
          block
          class="sm:flex-1"
          data-testid="game-again"
          @click="emit('again')"
        />
      </div>
    </main>

    <!-- A question -->
    <main
      v-else-if="step"
      :key="at"
      class="flex-1 mx-auto w-full max-w-2xl px-4 pt-8 sm:pt-12 pb-40 flex flex-col gap-6 animate-[game-in_0.2s_ease-out]"
    >
      <h1 class="text-2xl sm:text-3xl font-extrabold text-highlighted">
        {{ prompt }}
      </h1>

      <!-- A new word -->
      <div
        v-if="step.kind === 'learn'"
        class="tile p-6 sm:p-8 flex flex-col gap-4 cursor-default"
      >
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="grid place-items-center size-14 rounded-xl bg-primary text-inverted shadow-[0_4px_0_0_var(--ui-color-primary-700)] active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--ui-color-primary-700)] cursor-pointer"
            :aria-label="t('game.listen')"
            @click="speak(step.card.term)"
          >
            <UIcon
              name="i-lucide-volume-2"
              class="size-7"
            />
          </button>
          <div>
            <p class="text-3xl font-extrabold text-highlighted">
              {{ step.card.term }}
            </p>
            <p class="text-sm text-muted">
              {{ [step.card.partOfSpeech, step.card.ipa].filter(Boolean).join(' · ') }}
            </p>
          </div>
        </div>
        <p class="text-lg text-toned">
          {{ step.card.definition }}
        </p>
        <p
          v-if="step.card.translation"
          class="text-lg font-bold text-primary"
        >
          {{ step.card.translation }}
        </p>
        <p
          v-if="step.card.example"
          class="rounded-lg bg-elevated px-4 py-3 text-toned italic"
        >
          “{{ step.card.example }}”
        </p>
      </div>

      <!-- The meaning of a word, or the word for a meaning -->
      <template v-else-if="step.kind === 'meaning' || step.kind === 'reverse'">
        <div class="flex items-center gap-3">
          <button
            v-if="step.kind === 'meaning' && canSpeak"
            type="button"
            class="grid place-items-center size-12 rounded-xl bg-primary text-inverted shadow-[0_4px_0_0_var(--ui-color-primary-700)] active:translate-y-0.5 cursor-pointer shrink-0"
            :aria-label="t('game.listen')"
            @click="speak(step.card.term)"
          >
            <UIcon
              name="i-lucide-volume-2"
              class="size-6"
            />
          </button>
          <p
            v-if="step.kind === 'meaning'"
            class="text-3xl font-extrabold text-highlighted"
          >
            {{ step.card.term }}
          </p>
          <div
            v-else
            class="rounded-xl border-2 border-accented px-4 py-3"
          >
            <p class="text-lg text-highlighted font-bold">
              {{ step.card.definition }}
            </p>
            <p
              v-if="step.card.translation"
              class="text-primary font-bold"
            >
              {{ step.card.translation }}
            </p>
          </div>
        </div>
        <div
          class="grid gap-3"
          :class="step.kind === 'reverse' ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <button
            v-for="(o, i) in step.options"
            :key="o"
            type="button"
            class="tile flex items-center gap-3 px-4 py-3.5 text-start text-base sm:text-lg font-bold cursor-pointer disabled:cursor-default"
            :data-state="verdict ? (o === step.answer ? 'correct' : o === picked ? 'wrong' : undefined) : (o === picked ? 'selected' : undefined)"
            :disabled="!!verdict"
            data-testid="game-option"
            @click="picked = o"
          >
            <span class="grid place-items-center size-7 shrink-0 rounded-lg border-2 border-accented text-xs font-extrabold text-muted">{{ i + 1 }}</span>
            <span>{{ o }}</span>
          </button>
        </div>
      </template>

      <!-- Typing the word, or listening and spelling it -->
      <template v-else-if="step.kind === 'type' || step.kind === 'listen'">
        <div
          v-if="step.kind === 'type'"
          class="rounded-xl border-2 border-accented px-4 py-3"
        >
          <p class="text-lg text-highlighted font-bold">
            {{ step.card.definition }}
          </p>
          <p
            v-if="step.card.translation"
            class="text-primary font-bold"
          >
            {{ step.card.translation }}
          </p>
          <p
            v-if="exampleWithGap(step.card)"
            class="text-toned mt-2 italic"
          >
            “{{ exampleWithGap(step.card) }}”
          </p>
        </div>
        <div
          v-else
          class="flex items-center gap-3"
        >
          <button
            type="button"
            class="grid place-items-center size-20 rounded-2xl bg-primary text-inverted shadow-[0_5px_0_0_var(--ui-color-primary-700)] active:translate-y-1 active:shadow-[0_1px_0_0_var(--ui-color-primary-700)] cursor-pointer"
            :aria-label="t('game.listen')"
            @click="speak(step.card.term)"
          >
            <UIcon
              name="i-lucide-volume-2"
              class="size-10"
            />
          </button>
          <button
            type="button"
            class="grid place-items-center size-14 rounded-xl bg-elevated text-toned border-2 border-accented cursor-pointer"
            :aria-label="t('game.slower')"
            @click="speak(step.card.term, true)"
          >
            <UIcon
              name="i-lucide-snail"
              class="size-6"
            />
          </button>
        </div>
        <UInput
          ref="input"
          v-model="typed"
          size="xl"
          :placeholder="t('game.typeHere')"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="!!verdict"
          class="w-full"
          :ui="{ base: 'text-xl font-bold py-4' }"
          data-testid="game-input"
        />
      </template>

      <!-- Matching pairs -->
      <div
        v-else-if="step.kind === 'match'"
        class="grid grid-cols-2 gap-3"
      >
        <div class="flex flex-col gap-3">
          <button
            v-for="c in step.cards"
            :key="c.id"
            type="button"
            class="tile px-3 py-3 text-base font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default"
            :data-state="matched.has(c.id) ? 'correct' : matchLeft === c.id ? 'selected' : undefined"
            :disabled="matched.has(c.id)"
            data-testid="match-left"
            @click="matchLeft = c.id; speak(c.term)"
          >
            {{ c.term }}
          </button>
        </div>
        <div class="flex flex-col gap-3">
          <button
            v-for="c in rightCol"
            :key="c.id"
            type="button"
            class="tile px-3 py-3 text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default"
            :class="wrongFlash === c.id ? 'animate-[game-shake_0.4s]' : ''"
            :data-state="matched.has(c.id) ? 'correct' : wrongFlash === c.id ? 'wrong' : undefined"
            :disabled="matched.has(c.id)"
            data-testid="match-right"
            @click="pickRight(c)"
          >
            {{ meaningOf(c) }}
          </button>
        </div>
      </div>
    </main>

    <!-- The bar at the bottom: Check, then how it went and Continue -->
    <footer
      v-if="step && !finished"
      class="fixed inset-x-0 bottom-0 border-t-2 transition-colors duration-200 pb-safe"
      :class="verdict === 'wrong' ? 'bg-wrong/10 border-wrong/30' : verdict ? 'bg-correct/10 border-correct/30' : 'bg-default border-default'"
    >
      <div class="mx-auto w-full max-w-3xl px-4 py-4 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div
          v-if="verdict"
          class="flex items-start gap-3 flex-1 min-w-0"
          role="status"
          data-testid="game-verdict"
        >
          <span
            class="grid place-items-center size-12 shrink-0 rounded-full bg-default"
            :class="verdict === 'wrong' ? 'text-wrong' : 'text-correct'"
          >
            <UIcon
              :name="verdict === 'wrong' ? 'i-lucide-x' : 'i-lucide-check'"
              class="size-7"
            />
          </span>
          <div class="min-w-0">
            <p
              class="text-xl font-extrabold"
              :class="verdict === 'wrong' ? 'text-wrong' : 'text-correct'"
            >
              {{ verdict === 'wrong' ? t('game.correctAnswer') : verdict === 'close' && step.kind !== 'match' ? t('game.almost') : praise }}
            </p>
            <p
              v-if="step.kind !== 'learn' && step.kind !== 'match' && (verdict !== 'right')"
              class="font-bold"
              :class="verdict === 'wrong' ? 'text-wrong' : 'text-correct'"
            >
              {{ step.kind === 'meaning' ? step.card.definition : step.card.term }}
            </p>
          </div>
        </div>
        <div
          v-else
          class="hidden sm:block flex-1"
        />
        <UButton
          v-if="step.kind === 'learn' || verdict"
          :label="t('game.continue')"
          size="xl"
          :color="verdict === 'wrong' ? 'error' : step.kind === 'learn' ? 'primary' : 'success'"
          class="sm:min-w-44 justify-center"
          data-testid="game-continue"
          @click="next"
        />
        <UButton
          v-else-if="step.kind !== 'match'"
          :label="t('game.check')"
          size="xl"
          class="sm:min-w-44 justify-center"
          :disabled="!canCheck"
          data-testid="game-check"
          @click="check"
        />
      </div>
    </footer>

    <div
      v-if="!step && !finished"
      class="flex-1 grid place-items-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-dimmed"
      />
    </div>
  </div>
</template>
