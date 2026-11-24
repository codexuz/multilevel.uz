<script setup lang="ts">
import type { QuizQuestion } from '~/utils/words'

/**
 * A quiz on My Words: fill the gap in your own saved sentence (type the word, with its meaning as
 * the clue), or pick the meaning from four. ?mode=gap|meaning picks one kind; mixed by default.
 * A wrong answer brings the word forward to the next flashcard review. Keys: Enter checks and goes
 * on; 1–4 pick a meaning.
 */
const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
useSeoMeta({ title: () => t('words.practice'), robots: 'noindex' })

type Mode = 'mix' | 'gap' | 'meaning'
const mode = ref<Mode>(['gap', 'meaning'].includes(String(route.query.mode)) ? route.query.mode as Mode : 'mix')
const modes = computed(() => [
  { label: t('words.modeMix'), value: 'mix' },
  { label: t('words.modeGap'), value: 'gap' },
  { label: t('words.modeMeaning'), value: 'meaning' }
])

const questions = ref<QuizQuestion[]>([])
const saved = ref(0)
const loading = ref(true)
const at = ref(0)
/** The answer given to the question on screen: the word typed, or the choice picked. */
const typed = ref('')
const picked = ref<number | null>(null)
const verdict = ref<'right' | 'close' | 'wrong' | null>(null)
const showTranslation = ref(false)
const showLetter = ref(false)
const results = ref<{ q: QuizQuestion, verdict: 'right' | 'close' | 'wrong' }[]>([])
const gapInput = ref<HTMLInputElement | null>(null)

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ questions: QuizQuestion[], saved: number }>('/api/me/words/quiz', { query: { mode: mode.value, limit: 10, locale: locale.value } })
    questions.value = res.questions
    saved.value = res.saved
    at.value = 0
    results.value = []
    reset()
  } catch (e: any) {
    toast.add({ title: t('words.notLoaded'), description: e?.data?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(mode, (m) => {
  router.replace({ query: { ...route.query, mode: m === 'mix' ? undefined : m } })
  load()
})

const q = computed(() => questions.value[at.value] ?? null)
const finished = computed(() => !loading.value && questions.value.length > 0 && at.value >= questions.value.length)
const score = computed(() => results.value.filter(r => r.verdict !== 'wrong').length)
const missed = computed(() => results.value.filter(r => r.verdict === 'wrong'))
const progress = computed(() => (questions.value.length ? Math.round(results.value.length / questions.value.length * 100) : 0))

function reset() {
  typed.value = ''
  picked.value = null
  verdict.value = null
  showTranslation.value = false
  showLetter.value = false
  nextTick(() => gapInput.value?.focus())
}

function record(v: 'right' | 'close' | 'wrong') {
  const question = q.value!
  verdict.value = v
  results.value = [...results.value, { q: question, verdict: v }]
  $fetch(`/api/me/words/${question.wordId}/quiz`, { method: 'POST', body: { correct: v !== 'wrong' } }).catch(() => {})
}

function check() {
  const question = q.value
  if (!question || question.kind !== 'gap' || verdict.value || !typed.value.trim()) return
  record(markGap(typed.value, question.accept))
}

function pick(i: number) {
  const question = q.value
  if (!question || question.kind !== 'meaning' || verdict.value) return
  picked.value = i
  record(i === question.correct ? 'right' : 'wrong')
}

function next() {
  if (!verdict.value) return
  at.value++
  reset()
}

function choiceClass(i: number) {
  const question = q.value
  if (!question || question.kind !== 'meaning' || !verdict.value) return 'ring-default hover:bg-elevated'
  if (i === question.correct) return 'ring-success bg-success/10'
  if (i === picked.value) return 'ring-error bg-error/10'
  return 'ring-default opacity-60'
}

/** The gap's width: about the answer's length, so the length is a small clue too. */
const gapWidth = computed(() => (q.value?.kind === 'gap' ? `${Math.max(4, q.value.answer.length) + 2}ch` : '8ch'))

function onKey(e: KeyboardEvent) {
  if (!q.value) return
  if (e.key === 'Enter') {
    if (verdict.value) {
      e.preventDefault()
      next()
    } else if (q.value.kind === 'gap') {
      e.preventDefault()
      check()
    }
    return
  }
  if (q.value.kind === 'meaning' && !verdict.value && ['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault()
    pick(Number(e.key) - 1)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const canSpeak = ref(false)
onMounted(() => (canSpeak.value = 'speechSynthesis' in window))

/** The word a result was about, for the list of missed ones. */
const wordOf = (question: QuizQuestion) => (question.kind === 'gap' ? question.answer : question.word)
const meaningOf = (question: QuizQuestion) => (question.kind === 'gap' ? question.clue : question.choices[question.correct])
</script>

<template>
  <AppPage
    :title="t('words.practice')"
    icon="i-lucide-puzzle"
    back="/words"
  >
    <div class="flex flex-col gap-4 max-w-xl w-full">
      <UTabs
        v-model="mode"
        :items="modes"
        :content="false"
        size="sm"
        class="w-full"
        data-testid="quiz-modes"
      />

      <div
        v-if="loading"
        class="grid gap-3"
      >
        <USkeleton class="h-2 rounded-full" />
        <USkeleton class="h-64 rounded-2xl" />
      </div>

      <UEmpty
        v-else-if="!questions.length"
        icon="i-lucide-book-plus"
        :title="t('words.quizEmpty')"
        :description="saved ? t('words.quizEmptyFew') : t('words.emptyText')"
        :actions="[{ label: t('words.myWords'), to: '/words', color: 'neutral', variant: 'outline' }]"
        data-testid="quiz-empty"
      />

      <UCard
        v-else-if="finished"
        :ui="{ body: 'p-6 flex flex-col gap-4' }"
        data-testid="quiz-done"
      >
        <div class="flex flex-col items-center text-center gap-2">
          <UAvatar
            :icon="missed.length ? 'i-lucide-target' : 'i-lucide-trophy'"
            size="xl"
            class="rounded-xl"
            :ui="{ root: missed.length ? 'bg-primary/10' : 'bg-success/10', icon: missed.length ? 'text-primary' : 'text-success' }"
          />
          <p class="text-xl font-semibold text-highlighted">
            {{ t('words.quizScore', { n: score, of: questions.length }) }}
          </p>
          <p class="text-sm text-muted">
            {{ missed.length ? t('words.quizMissedNote') : t('words.quizPerfect') }}
          </p>
        </div>
        <div
          v-if="missed.length"
          class="rounded-lg ring ring-default divide-y divide-default"
        >
          <div
            v-for="r in missed"
            :key="r.q.wordId + r.q.kind"
            class="px-3 py-2"
          >
            <p class="font-medium text-highlighted">
              {{ wordOf(r.q) }}
            </p>
            <p class="text-sm text-toned">
              {{ meaningOf(r.q) }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap justify-center gap-2">
          <UButton
            v-if="missed.length"
            to="/words/review"
            :label="t('words.reviewNow')"
            icon="i-lucide-layers"
          />
          <UButton
            :label="t('words.newQuiz')"
            icon="i-lucide-rotate-ccw"
            :color="missed.length ? 'neutral' : 'primary'"
            :variant="missed.length ? 'outline' : 'solid'"
            @click="load"
          />
          <UButton
            to="/words"
            :label="t('words.backToWords')"
            color="neutral"
            variant="ghost"
          />
        </div>
      </UCard>

      <template v-else-if="q">
        <div class="flex items-center gap-3">
          <UProgress
            :model-value="progress"
            size="sm"
            class="flex-1"
          />
          <span class="text-sm text-muted tabular-nums">{{ at + 1 }}/{{ questions.length }}</span>
        </div>

        <!-- Fill the gap -->
        <UCard
          v-if="q.kind === 'gap'"
          :ui="{ body: 'p-6 sm:p-8 flex flex-col gap-5' }"
          data-testid="quiz-gap"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ t('words.gapTitle') }}
          </p>
          <p class="text-lg leading-9 text-default">
            {{ q.before }}<input
              ref="gapInput"
              v-model="typed"
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :readonly="!!verdict"
              :aria-label="t('words.gapLabel')"
              :placeholder="showLetter ? `${q.answer[0]}…` : ''"
              class="mx-1 px-2 py-0.5 rounded-md border-b-2 bg-elevated text-center font-semibold outline-none focus:border-primary"
              :class="verdict === 'wrong' ? 'border-error text-error line-through' : verdict ? 'border-success text-success' : 'border-accented'"
              :style="{ width: gapWidth }"
              data-testid="gap-input"
            >{{ q.after }}
          </p>
          <div class="rounded-lg bg-elevated p-3 flex flex-col gap-1">
            <p class="text-xs text-muted">
              {{ t('words.clue') }}<span v-if="q.partOfSpeech"> · <i>{{ q.partOfSpeech }}</i></span>
            </p>
            <p class="text-sm leading-6">
              {{ q.clue || t('words.noMeaning') }}
            </p>
            <p
              v-if="q.translation && (showTranslation || verdict)"
              class="text-sm font-medium text-primary"
            >
              {{ q.translation }}
            </p>
          </div>
          <div
            v-if="!verdict"
            class="flex flex-wrap gap-2"
          >
            <UButton
              v-if="q.translation && !showTranslation"
              :label="t('words.showTranslation')"
              icon="i-lucide-languages"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showTranslation = true"
            />
            <UButton
              v-if="!showLetter"
              :label="t('words.firstLetter')"
              icon="i-lucide-lightbulb"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showLetter = true; gapInput?.focus()"
            />
          </div>
          <UAlert
            v-if="verdict"
            :color="verdict === 'wrong' ? 'error' : 'success'"
            variant="subtle"
            :icon="verdict === 'wrong' ? 'i-lucide-x' : 'i-lucide-check'"
            :title="verdict === 'right' ? t('words.right') : verdict === 'close' ? t('words.close', { answer: q.answer }) : t('words.wrong', { answer: q.answer })"
            data-testid="quiz-verdict"
          />
        </UCard>

        <!-- Pick the meaning -->
        <UCard
          v-else
          :ui="{ body: 'p-6 sm:p-8 flex flex-col gap-4' }"
          data-testid="quiz-meaning"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">
            {{ t('words.meaningTitle') }}
          </p>
          <div class="flex items-center gap-2">
            <p class="text-3xl font-bold text-highlighted break-words min-w-0 flex-1">
              {{ q.word }}
            </p>
            <UButton
              v-if="canSpeak"
              icon="i-lucide-volume-2"
              color="neutral"
              variant="ghost"
              :aria-label="t('words.listen')"
              @click="speakWord(q.word)"
            />
          </div>
          <p
            v-if="q.context"
            class="text-sm text-toned leading-6 border-s-2 border-default ps-3"
          >
            {{ q.context.before }}<strong class="text-highlighted">{{ q.context.answer }}</strong>{{ q.context.after }}
          </p>
          <div class="flex flex-col gap-2">
            <button
              v-for="(c, i) in q.choices"
              :key="i"
              type="button"
              class="flex items-start gap-3 rounded-lg ring p-3 text-start text-sm leading-6 transition-colors disabled:cursor-default"
              :class="choiceClass(i)"
              :disabled="!!verdict"
              :data-testid="`choice-${i}`"
              @click="pick(i)"
            >
              <span class="shrink-0 size-6 rounded-full bg-elevated text-xs font-semibold flex items-center justify-center">{{ i + 1 }}</span>
              <span>{{ c }}</span>
            </button>
          </div>
        </UCard>

        <UButton
          v-if="q.kind === 'gap' && !verdict"
          :label="t('words.check')"
          icon="i-lucide-check"
          size="xl"
          block
          :disabled="!typed.trim()"
          data-testid="quiz-check"
          @click="check"
        />
        <UButton
          v-else-if="verdict"
          :label="at + 1 < questions.length ? t('words.next') : t('words.seeScore')"
          trailing-icon="i-lucide-arrow-right"
          size="xl"
          block
          data-testid="quiz-next"
          @click="next"
        />
        <p class="text-xs text-muted text-center max-sm:hidden">
          {{ q.kind === 'gap' ? t('words.keysGap') : t('words.keysMeaning') }}
        </p>
      </template>
    </div>
  </AppPage>
</template>
