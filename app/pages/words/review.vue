<script setup lang="ts">
import type { SavedWord, WordStats } from '~/utils/words'

/**
 * Reviewing My Words with flashcards: the word and the sentence it came from; Show meaning turns
 * the card; then Again, Hard or Good says how it went, and the schedule (shared/utils/word-review.ts)
 * brings it back sooner or later. A word answered Again comes round once more before the end.
 * Keys: Space turns the card, 1 2 3 answer it. ?ahead=1 practises the soonest words when none are due.
 */
const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
useSeoMeta({ title: () => t('words.review'), robots: 'noindex' })

const ahead = ref(route.query.ahead === '1')
const queue = ref<SavedWord[]>([])
const loading = ref(true)
const flipped = ref(false)
const busy = ref(false)
const done = reactive({ again: 0, hard: 0, good: 0 })
/** Words in this session, each counted once however often it came round. */
const seen = ref(new Set<string>())
const total = ref(0)

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ items: SavedWord[], ahead: boolean }>('/api/me/words/due', { query: { locale: locale.value, ahead: ahead.value ? '1' : undefined } })
    queue.value = res.items
    total.value = res.items.length
    seen.value = new Set()
    Object.assign(done, { again: 0, hard: 0, good: 0 })
    flipped.value = false
  } catch (e: any) {
    toast.add({ title: t('words.notLoaded'), description: e?.data?.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const card = computed(() => queue.value[0] ?? null)
const head = computed(() => (card.value ? (card.value.lemma && card.value.lemma !== card.value.term ? card.value.lemma : card.value.word) : ''))
const sentence = computed(() => (card.value?.sentence ? splitSentence(card.value.sentence, card.value.word) : null))
const progress = computed(() => (total.value ? Math.round(seen.value.size / total.value * 100) : 0))
const finished = computed(() => !loading.value && total.value > 0 && !queue.value.length)

/** When each answer would bring the card back, shown on its button. */
const hints = computed(() => {
  if (!card.value) return { again: '', hard: '', good: '' }
  const say = (g: Grade) => {
    const next = scheduleReview(card.value!.box, g)
    if (g === 'again') return t('words.inMinutes', { n: AGAIN_MINUTES })
    return next.days < 1 ? t('words.inHours', { n: Math.round(next.days * 24) }) : t('words.inDays', { n: next.days }, next.days)
  }
  return { again: say('again'), hard: say('hard'), good: say('good') }
})

const canSpeak = ref(false)
onMounted(() => (canSpeak.value = canSpeakWords()))
onBeforeUnmount(stopSpeaking)

function flip() {
  if (!card.value) return
  flipped.value = true
}

async function grade(g: Grade) {
  const word = card.value
  if (!word || !flipped.value || busy.value) return
  busy.value = true
  try {
    const { word: updated } = await $fetch<{ word: SavedWord }>(`/api/me/words/${word.id}/review`, { method: 'POST', body: { grade: g } })
    done[g]++
    seen.value = new Set(seen.value).add(word.id)
    const rest = queue.value.slice(1)
    // Again: asked once more at the end of this session.
    queue.value = g === 'again' ? [...rest, updated] : rest
    flipped.value = false
  } catch (e: any) {
    toast.add({ title: t('words.notGraded'), description: e?.data?.message, color: 'error' })
  } finally {
    busy.value = false
  }
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
  if (!card.value) return
  if ((e.key === ' ' || e.key === 'Enter') && !flipped.value) {
    e.preventDefault()
    flip()
  } else if (flipped.value && ['1', '2', '3'].includes(e.key)) {
    e.preventDefault()
    grade(GRADES[Number(e.key) - 1]!)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// For the end of the session: is there more to do?
const { data: stats, refresh: refreshStats } = await useFetch<WordStats>('/api/me/words/stats', { lazy: true, immediate: false })
watch(finished, f => f && refreshStats())

function again(practiseAhead: boolean) {
  ahead.value = practiseAhead
  load()
}
</script>

<template>
  <AppPage
    :title="t('words.review')"
    icon="i-lucide-layers"
    back="/words"
  >
    <div class="flex flex-col gap-4 max-w-xl w-full">
      <div
        v-if="loading"
        class="grid gap-3"
      >
        <USkeleton class="h-2 rounded-full" />
        <USkeleton class="h-72 rounded-2xl" />
      </div>

      <UEmpty
        v-else-if="!total"
        icon="i-lucide-circle-check"
        :title="t('words.nothingDue')"
        :description="t('words.nothingDueText')"
        :actions="[
          { label: t('words.practiseAhead'), icon: 'i-lucide-fast-forward', onClick: () => again(true) },
          { label: t('words.myWords'), to: '/words', color: 'neutral', variant: 'outline' }
        ]"
        data-testid="nothing-due"
      />

      <UCard
        v-else-if="finished"
        :ui="{ body: 'p-6 flex flex-col items-center text-center gap-4' }"
        data-testid="review-done"
      >
        <UAvatar
          icon="i-lucide-party-popper"
          size="xl"
          class="rounded-xl"
          :ui="{ root: 'bg-success/10', icon: 'text-success' }"
        />
        <div>
          <p class="text-xl font-semibold text-highlighted">
            {{ t('words.doneTitle') }}
          </p>
          <p class="text-sm text-muted mt-1">
            {{ t('words.doneText', { n: seen.size }, seen.size) }}
          </p>
        </div>
        <div class="grid grid-cols-3 gap-3 w-full">
          <div class="rounded-lg bg-error/10 p-3">
            <p class="text-2xl font-semibold text-error">
              {{ done.again }}
            </p>
            <p class="text-xs text-muted">
              {{ t('words.gradeAgain') }}
            </p>
          </div>
          <div class="rounded-lg bg-warning/10 p-3">
            <p class="text-2xl font-semibold text-warning">
              {{ done.hard }}
            </p>
            <p class="text-xs text-muted">
              {{ t('words.gradeHard') }}
            </p>
          </div>
          <div class="rounded-lg bg-success/10 p-3">
            <p class="text-2xl font-semibold text-success">
              {{ done.good }}
            </p>
            <p class="text-xs text-muted">
              {{ t('words.gradeGood') }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap justify-center gap-2">
          <UButton
            v-if="stats?.due"
            :label="t('words.reviewMore', { n: stats.due }, stats.due)"
            icon="i-lucide-play"
            @click="again(false)"
          />
          <UButton
            to="/words/practice"
            :label="t('words.tryQuiz')"
            icon="i-lucide-puzzle"
            color="neutral"
            variant="outline"
          />
          <UButton
            to="/words"
            :label="t('words.backToWords')"
            color="neutral"
            :variant="stats?.due ? 'outline' : 'solid'"
          />
        </div>
      </UCard>

      <template v-else-if="card">
        <div class="flex items-center gap-3">
          <UProgress
            :model-value="progress"
            size="sm"
            class="flex-1"
          />
          <span class="text-sm text-muted tabular-nums">{{ seen.size }}/{{ total }}</span>
        </div>
        <p
          v-if="ahead"
          class="text-sm text-muted -mt-2"
        >
          {{ t('words.aheadNote') }}
        </p>

        <UCard
          :ui="{ body: 'p-6 sm:p-8 flex flex-col gap-5 min-h-72' }"
          data-testid="flashcard"
        >
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <p
                class="text-3xl font-bold text-highlighted break-words"
                data-testid="flashcard-word"
              >
                {{ head }}
              </p>
              <p
                v-if="flipped && (card.partOfSpeech || card.cefr)"
                class="flex items-center gap-2 mt-1"
              >
                <span
                  v-if="card.partOfSpeech"
                  class="text-sm italic text-muted"
                >{{ card.partOfSpeech }}</span>
                <UBadge
                  v-if="card.cefr"
                  :label="card.cefr"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
              </p>
            </div>
            <UButton
              v-if="canSpeak"
              icon="i-lucide-volume-2"
              color="neutral"
              variant="ghost"
              :aria-label="t('words.listen')"
              @click="speakWord(head)"
            />
            <WordsProgress
              :box="card.box"
              class="mt-3"
            />
          </div>

          <p
            v-if="sentence"
            class="text-toned leading-7 border-s-2 border-default ps-3"
          >
            {{ sentence[0] }}<strong class="text-highlighted">{{ sentence[1] }}</strong>{{ sentence[2] }}
          </p>

          <div
            v-if="flipped"
            class="flex flex-col gap-2 border-t border-default pt-4"
            data-testid="flashcard-back"
          >
            <p class="text-lg leading-7">
              {{ card.definition || t('words.noMeaning') }}
            </p>
            <p
              v-if="card.translation"
              class="text-lg font-medium text-primary"
            >
              {{ card.translation }}
            </p>
          </div>
          <p
            v-else
            class="text-sm text-muted mt-auto"
          >
            {{ t('words.recallPrompt') }}
          </p>
        </UCard>

        <UButton
          v-if="!flipped"
          :label="t('words.showMeaning')"
          icon="i-lucide-rotate-3d"
          size="xl"
          block
          data-testid="flip"
          @click="flip"
        />
        <div
          v-else
          class="grid grid-cols-3 gap-2"
        >
          <UButton
            color="error"
            variant="soft"
            size="xl"
            block
            :disabled="busy"
            :ui="{ base: 'flex-col gap-0 py-2' }"
            data-testid="grade-again"
            @click="grade('again')"
          >
            <span class="font-semibold">{{ t('words.gradeAgain') }}</span>
            <span class="text-xs opacity-80">{{ hints.again }}</span>
          </UButton>
          <UButton
            color="warning"
            variant="soft"
            size="xl"
            block
            :disabled="busy"
            :ui="{ base: 'flex-col gap-0 py-2' }"
            data-testid="grade-hard"
            @click="grade('hard')"
          >
            <span class="font-semibold">{{ t('words.gradeHard') }}</span>
            <span class="text-xs opacity-80">{{ hints.hard }}</span>
          </UButton>
          <UButton
            color="success"
            variant="soft"
            size="xl"
            block
            :disabled="busy"
            :ui="{ base: 'flex-col gap-0 py-2' }"
            data-testid="grade-good"
            @click="grade('good')"
          >
            <span class="font-semibold">{{ t('words.gradeGood') }}</span>
            <span class="text-xs opacity-80">{{ hints.good }}</span>
          </UButton>
        </div>
        <p class="text-xs text-muted text-center max-sm:hidden">
          {{ flipped ? t('words.keysGrade') : t('words.keysFlip') }}
        </p>
      </template>
    </div>
  </AppPage>
</template>
