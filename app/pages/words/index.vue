<script setup lang="ts">
import type { SavedWord, WordStats } from '~/utils/words'

/**
 * My Words: the words a student saved from Reading, how they are getting on, and the way into
 * today's review. Search them, narrow them to due, new, being learnt or known, and remove any.
 */
const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

// My saved words, or the decks my teachers set (?tab=decks).
const area = computed<'saved' | 'decks'>({
  get: () => (route.query.tab === 'decks' ? 'decks' : 'saved'),
  set: v => router.replace({ query: { ...route.query, tab: v === 'decks' ? 'decks' : undefined } })
})
interface MyDeck { id: string, title: string, description: string | null, category: string | null, topic: string | null, level: string | null, teacher: string, cards: number, known: number, seen: number, toPlay: number }
const { data: decks, status: decksStatus } = await useFetch('/api/me/decks', { lazy: true, transform: (r: { decks: MyDeck[] }) => r.decks, default: (): MyDeck[] => [] })
const areaTabs = computed(() => [
  { label: t('words.tabSaved'), value: 'saved', icon: 'i-lucide-bookmark' },
  { label: t('words.tabDecks'), value: 'decks', icon: 'i-lucide-layers', badge: decks.value.reduce((n, d) => n + (d.toPlay ? 1 : 0), 0) || undefined }
])
useSeoMeta({ title: () => t('words.myWords'), robots: 'noindex' })

const { data: stats, refresh: refreshStats } = await useFetch<WordStats>('/api/me/words/stats', { lazy: true })

const show = ref<'all' | 'due' | 'new' | 'learning' | 'known'>('all')
const search = ref('')
// The search goes out once typing pauses.
const q = ref('')
let typing: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(typing)
  typing = setTimeout(() => (q.value = v.trim()), 300)
})
const page = ref(1)
const PAGE_SIZE = 30
const items = ref<SavedWord[]>([])
const total = ref(0)

const { data, status } = await useFetch<{ items: SavedWord[], total: number, totalPages: number }>('/api/me/words', {
  query: { q, show: computed(() => (show.value === 'all' ? undefined : show.value)), page, pageSize: PAGE_SIZE },
  lazy: true
})
// A new search or filter starts at the first page.
watch([q, show], () => (page.value = 1))
watch(data, (d) => {
  if (!d) return
  items.value = d.items
  total.value = d.total
}, { immediate: true })
watch(page, () => import.meta.client && window.scrollTo({ top: 0, behavior: 'smooth' }))

const tabs = computed(() => [
  { label: t('words.showAll'), value: 'all' },
  { label: t('words.showDue'), value: 'due', badge: stats.value?.due || undefined },
  { label: t('words.showNew'), value: 'new' },
  { label: t('words.showLearning'), value: 'learning' },
  { label: t('words.showKnown'), value: 'known' }
])

const next = computed(() => {
  if (!stats.value?.nextDueAt) return null
  const days = Math.round((new Date(stats.value.nextDueAt).getTime() - Date.now()) / 86_400_000)
  return days < 1 ? t('words.nextReviewToday') : t('words.nextReviewIn', { n: days }, days)
})

async function remove(word: SavedWord) {
  try {
    await $fetch(`/api/me/words/${word.id}`, { method: 'DELETE' })
    items.value = items.value.filter(w => w.id !== word.id)
    total.value--
    refreshStats()
    // The last word of a page: step back a page.
    if (!items.value.length && page.value > 1) page.value--
  } catch (e: any) {
    toast.add({ title: t('words.notRemoved'), description: e?.data?.message, color: 'error' })
  }
}
</script>

<template>
  <AppPage
    :title="t('words.myWords')"
    icon="i-lucide-book-open-text"
  >
    <div class="flex flex-col gap-4 max-w-3xl w-full pb-16 lg:pb-0">
      <UTabs
        v-model="area"
        :items="areaTabs"
        :content="false"
        class="w-full sm:w-fit"
        data-testid="words-area"
      />

      <template v-if="area === 'saved'">
        <UCard
          v-if="stats?.total"
          :ui="{ body: 'p-3 sm:p-5' }"
          data-testid="review-cta"
        >
          <div class="flex items-center gap-3 sm:gap-4">
            <UAvatar
              :icon="stats.due ? 'i-lucide-layers' : 'i-lucide-circle-check'"
              size="lg"
              class="rounded-lg max-sm:hidden"
              :ui="{ root: stats.due ? 'bg-primary/10' : 'bg-success/10', icon: stats.due ? 'text-primary' : 'text-success' }"
            />
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-highlighted">
                {{ stats.due ? t('words.dueCount', { n: stats.due }, stats.due) : t('words.caughtUp') }}
              </p>
              <p class="text-sm text-muted max-sm:hidden">
                {{ stats.due ? t('words.dueText') : (next ?? t('words.caughtUpText')) }}
              </p>
            </div>
            <UButton
              v-if="stats.due"
              to="/words/review"
              icon="i-lucide-play"
              size="lg"
              class="shrink-0"
            >
              <span class="max-sm:hidden">{{ t('words.startReview') }}</span><span class="sm:hidden">{{ t('words.review') }}</span>
            </UButton>
            <UButton
              v-else
              to="/words/review?ahead=1"
              icon="i-lucide-fast-forward"
              color="neutral"
              variant="outline"
              class="shrink-0"
            >
              <span class="max-sm:hidden">{{ t('words.practiseAhead') }}</span><span class="sm:hidden">{{ t('words.review') }}</span>
            </UButton>
          </div>
        </UCard>

        <div
          v-if="stats?.total"
          class="rounded-[var(--card-radius)] bg-primary text-inverted p-3 sm:p-5 flex flex-wrap items-center gap-3 sm:gap-4 shadow-[0_var(--press)_0_0_var(--ui-color-primary-700)]"
          data-testid="quiz-cta"
        >
          <span class="grid place-items-center size-10 sm:size-14 rounded-xl bg-white/15 shrink-0">
            <UIcon
              name="i-lucide-gamepad-2"
              class="size-6 sm:size-8"
            />
          </span>
          <div class="min-w-0 flex-1">
            <p class="sm:text-lg font-extrabold">
              {{ t('words.playCta') }}
            </p>
            <p class="text-sm opacity-85 max-sm:hidden">
              {{ t('words.playCtaText') }}
            </p>
          </div>
          <UButton
            to="/words/play"
            :label="t('words.play')"
            icon="i-lucide-play"
            color="neutral"
            variant="solid"
            size="lg"
            class="bg-white text-primary hover:bg-white/90"
            data-testid="play-saved"
          />
          <div class="w-full flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold max-sm:hidden">
            <ULink
              to="/words/practice?mode=gap"
              class="text-inverted/85 hover:text-inverted underline-offset-4 hover:underline"
            >
              {{ t('words.modeGap') }}
            </ULink>
            <ULink
              to="/words/practice?mode=meaning"
              class="text-inverted/85 hover:text-inverted underline-offset-4 hover:underline"
            >
              {{ t('words.modeMeaning') }}
            </ULink>
          </div>
        </div>

        <!-- Phones: the counts in one strip -->
        <div
          v-if="stats?.total"
          class="sm:hidden grid grid-cols-4 rounded-[var(--card-radius)] ring-2 ring-default bg-default divide-x-2 divide-default"
          data-testid="words-stats-strip"
        >
          <div
            v-for="s in [
              { label: t('words.statTotal'), value: stats.total, tone: 'text-highlighted' },
              { label: t('words.showNew'), value: stats.new, tone: 'text-info' },
              { label: t('words.showLearning'), value: stats.learning, tone: 'text-warning' },
              { label: t('words.showKnown'), value: stats.known, tone: 'text-success' }
            ]"
            :key="s.label"
            class="py-2 text-center min-w-0"
          >
            <p
              class="text-lg font-extrabold tabular-nums leading-tight"
              :class="s.tone"
            >
              {{ s.value }}
            </p>
            <p class="text-[11px] font-bold text-muted truncate px-1">
              {{ s.label }}
            </p>
          </div>
        </div>
        <div
          v-if="stats?.total"
          class="max-sm:hidden grid grid-cols-4 gap-3"
        >
          <StatTile
            :label="t('words.statTotal')"
            :value="stats.total"
            icon="i-lucide-book-open-text"
          />
          <StatTile
            :label="t('words.showNew')"
            :value="stats.new"
            icon="i-lucide-sparkle"
            color="info"
          />
          <StatTile
            :label="t('words.showLearning')"
            :value="stats.learning"
            icon="i-lucide-trending-up"
            color="warning"
          />
          <StatTile
            :label="t('words.showKnown')"
            :value="stats.known"
            icon="i-lucide-badge-check"
            color="success"
          />
        </div>

        <template v-if="stats?.total">
          <div class="flex sm:flex-wrap items-center gap-2">
            <UTabs
              v-model="show"
              :items="tabs"
              :content="false"
              size="sm"
              class="min-w-0 overflow-x-auto max-sm:hidden"
            />
            <USelect
              v-model="show"
              :items="tabs.map(x => ({ label: x.badge ? `${x.label} (${x.badge})` : x.label, value: x.value }))"
              class="sm:hidden w-32 shrink-0"
              :aria-label="t('tests.filters')"
            />
            <UInput
              v-model="search"
              icon="i-lucide-search"
              :placeholder="t('words.search')"
              class="flex-1 min-w-0 sm:flex-none sm:w-56 sm:ms-auto"
            />
          </div>

          <div
            v-if="status === 'pending' && !items.length"
            class="grid gap-2"
          >
            <USkeleton
              v-for="i in 5"
              :key="i"
              class="h-16 rounded-lg"
            />
          </div>
          <div
            v-else-if="items.length"
            class="rounded-lg ring ring-default divide-y divide-default overflow-hidden"
          >
            <WordsRow
              v-for="w in items"
              :key="w.id"
              :word="w"
              @remove="remove(w)"
            />
          </div>
          <UEmpty
            v-else
            icon="i-lucide-search-x"
            :title="t('words.noneHere')"
            variant="naked"
          />
          <div
            v-if="total > PAGE_SIZE"
            class="flex flex-col sm:flex-row items-center justify-between gap-2"
          >
            <p class="text-sm text-muted tabular-nums max-sm:hidden">
              {{ t('words.pageRange', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total }) }}
            </p>
            <UPagination
              v-model:page="page"
              :total="total"
              :items-per-page="PAGE_SIZE"
              :sibling-count="1"
              :show-edges="false"
              data-testid="words-pages"
            />
          </div>
        </template>

        <UEmpty
          v-else-if="stats"
          icon="i-lucide-book-plus"
          :title="t('words.emptyTitle')"
          :description="t('words.emptyText')"
          :actions="[{ label: t('words.emptyAction'), to: '/tests', icon: 'i-lucide-book-open' }]"
          data-testid="words-empty"
        />
      </template>

      <template v-else>
        <div
          v-if="decksStatus === 'pending' && !decks.length"
          class="grid sm:grid-cols-2 gap-3"
        >
          <USkeleton
            v-for="i in 4"
            :key="i"
            class="h-40 rounded-[var(--card-radius)]"
          />
        </div>
        <div
          v-else-if="decks.length"
          class="grid sm:grid-cols-2 gap-3"
          data-testid="my-decks"
        >
          <UCard
            v-for="d in decks"
            :key="d.id"
            :ui="{ body: 'p-4 sm:p-5 flex flex-col gap-3 h-full' }"
          >
            <div class="flex items-start gap-3">
              <span class="grid place-items-center size-11 rounded-lg bg-primary/10 text-primary shrink-0">
                <UIcon
                  name="i-lucide-layers"
                  class="size-6"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="font-extrabold text-highlighted truncate">
                  {{ d.title }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ [d.topic, d.teacher].filter(Boolean).join(' · ') }}
                </p>
              </div>
              <UBadge
                v-if="d.level"
                :label="d.level"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>
            <div>
              <div class="flex justify-between text-xs font-bold text-muted mb-1 tabular-nums">
                <span>{{ t('words.deckKnown', { n: d.known, total: d.cards }) }}</span>
                <span v-if="d.toPlay">{{ t('words.deckToPlay', { n: d.toPlay }, d.toPlay) }}</span>
              </div>
              <div class="h-3 rounded-full bg-accented/70 overflow-hidden">
                <div
                  class="h-full rounded-full bg-correct transition-[width] duration-500"
                  :style="{ width: `${d.cards ? Math.round(d.known / d.cards * 100) : 0}%` }"
                />
              </div>
            </div>
            <UPageList class="flex-row flex-wrap items-center gap-2 mt-auto">
              <UButton
                :to="`/words/decks/${d.id}`"
                :label="t('deckStudy.studyWords')"
                icon="i-lucide-book-open"
                :color="d.toPlay ? 'primary' : 'neutral'"
                :variant="d.toPlay ? 'solid' : 'outline'"
                :disabled="!d.cards"
                class="flex-1 justify-center min-w-36"
              />
              <UButton
                :to="`/words/play?deck=${d.id}`"
                :label="d.toPlay ? t('words.play') : t('words.playAgain')"
                :icon="d.toPlay ? 'i-lucide-play' : 'i-lucide-rotate-ccw'"
                color="neutral"
                variant="outline"
                :disabled="!d.cards"
                class="justify-center"
              />
            </UPageList>
          </UCard>
        </div>
        <UEmpty
          v-else
          icon="i-lucide-layers"
          :title="t('words.decksEmpty')"
          :description="t('words.decksEmptyText')"
          data-testid="decks-empty"
        />
      </template>
    </div>
  </AppPage>
</template>
