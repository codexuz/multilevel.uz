<script setup lang="ts">
import type { SavedWord, WordStats } from '~/utils/words'

/**
 * My Words: the words a student saved from Reading, how they are getting on, and the way into
 * today's review. Search them, narrow them to due, new, being learnt or known, and remove any.
 */
const { t } = useI18n()
const toast = useToast()
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
const items = ref<SavedWord[]>([])
const total = ref(0)

const { data, status } = await useFetch<{ items: SavedWord[], total: number, totalPages: number }>('/api/me/words', {
  query: { q, show: computed(() => (show.value === 'all' ? undefined : show.value)), page, pageSize: 30 },
  lazy: true
})
// A new search or filter starts the list again; Load more adds the next page under it.
watch([q, show], () => (page.value = 1))
watch(data, (d) => {
  if (!d) return
  items.value = page.value === 1 ? d.items : [...items.value, ...d.items.filter(w => !items.value.some(x => x.id === w.id))]
  total.value = d.total
}, { immediate: true })
const more = computed(() => items.value.length < total.value)

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
    <div class="flex flex-col gap-4 max-w-3xl w-full">
      <UCard
        v-if="stats?.total"
        :ui="{ body: 'p-4 sm:p-5' }"
        data-testid="review-cta"
      >
        <div class="flex flex-wrap items-center gap-4">
          <UAvatar
            :icon="stats.due ? 'i-lucide-layers' : 'i-lucide-circle-check'"
            size="lg"
            class="rounded-lg"
            :ui="{ root: stats.due ? 'bg-primary/10' : 'bg-success/10', icon: stats.due ? 'text-primary' : 'text-success' }"
          />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">
              {{ stats.due ? t('words.dueCount', { n: stats.due }, stats.due) : t('words.caughtUp') }}
            </p>
            <p class="text-sm text-muted">
              {{ stats.due ? t('words.dueText') : (next ?? t('words.caughtUpText')) }}
            </p>
          </div>
          <UButton
            v-if="stats.due"
            to="/words/review"
            :label="t('words.startReview')"
            icon="i-lucide-play"
            size="lg"
          />
          <UButton
            v-else
            to="/words/review?ahead=1"
            :label="t('words.practiseAhead')"
            icon="i-lucide-fast-forward"
            color="neutral"
            variant="outline"
          />
        </div>
      </UCard>

      <div
        v-if="stats?.total"
        class="grid grid-cols-2 sm:grid-cols-4 gap-3"
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
        <div class="flex flex-wrap items-center gap-2">
          <UTabs
            v-model="show"
            :items="tabs"
            :content="false"
            size="sm"
            class="min-w-0 overflow-x-auto"
          />
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('words.search')"
            class="w-full sm:w-56 sm:ms-auto"
          />
        </div>

        <div
          v-if="status === 'pending' && !items.length"
          class="grid gap-2"
        >
          <USkeleton
            v-for="i in 5"
            :key="i"
            class="h-16 rounded-xl"
          />
        </div>
        <div
          v-else-if="items.length"
          class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
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
        <UButton
          v-if="more"
          :label="t('words.loadMore')"
          color="neutral"
          variant="outline"
          class="self-center"
          :loading="status === 'pending'"
          @click="page++"
        />
      </template>

      <UEmpty
        v-else-if="stats"
        icon="i-lucide-book-plus"
        :title="t('words.emptyTitle')"
        :description="t('words.emptyText')"
        :actions="[{ label: t('words.emptyAction'), to: '/tests', icon: 'i-lucide-book-open' }]"
        data-testid="words-empty"
      />
    </div>
  </AppPage>
</template>
