<script setup lang="ts">
import type { BreadcrumbItem, TabsItem } from '@nuxt/ui'

interface DeckWordItem {
  id: string
  position: number
  term: string
  partOfSpeech: string | null
  ipa: string | null
  definition: string
  example: string | null
  translationUz: string | null
  translationRu: string | null
  box: number
  status: 'new' | 'learning' | 'known'
  due: boolean
  correct: number
  wrong: number
}

interface DeckDetailPayload {
  deck: {
    id: string
    title: string
    description: string | null
    category: string | null
    topic: string | null
    level: string | null
    teacher: string | null
  }
  stats: {
    total: number
    newCount: number
    learning: number
    known: number
    due: number
  }
  cards: DeckWordItem[]
}

const { t, locale } = useI18n()
const route = useRoute()
const deckId = computed(() => String(route.params.id))
const playPath = computed(() => `/words/play?deck=${deckId.value}`)

const { data, status, error } = await useFetch<DeckDetailPayload>(() => `/api/me/decks/${deckId.value}`)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: t('deckStudy.notFound'), fatal: true })
}

useSeoMeta({
  title: () => (data.value ? `${data.value.deck.title} · ${t('words.myWords')}` : t('words.tabDecks')),
  robots: 'noindex'
})

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  if (!data.value) return []
  return [
    { label: t('words.myWords'), icon: 'i-lucide-book-open-text', to: '/words' },
    { label: t('words.tabDecks'), icon: 'i-lucide-layers', to: '/words?tab=decks' },
    { label: data.value.deck.title }
  ]
})

const masteryPct = computed(() => {
  const total = data.value?.stats.total ?? 0
  return total ? Math.round(((data.value?.stats.known ?? 0) / total) * 100) : 0
})

const translationOf = (c: DeckWordItem) => {
  if (locale.value === 'uz') return c.translationUz || c.translationRu || null
  if (locale.value === 'ru') return c.translationRu || c.translationUz || null
  return null
}

const statusBadge = (c: DeckWordItem) => {
  if (c.status === 'known') return { label: t('words.showKnown'), color: 'success' as const, icon: 'i-lucide-circle-check' }
  if (c.status === 'learning') return { label: t('words.showLearning'), color: 'warning' as const, icon: 'i-lucide-flame' }
  return { label: t('words.showNew'), color: 'info' as const, icon: 'i-lucide-sparkles' }
}

// ---- Pronounce with Speechify TTS (browser fallback) ----
const canSpeak = ref(false)
function speak(word: string) {
  speakWord(word)
}

// ---- Study Mode Tabs (Word List vs Flashcards) ----
const mode = ref<'list' | 'flashcards'>('list')
const modeTabs = computed<TabsItem[]>(() => [
  { label: t('deckStudy.tabList'), value: 'list', icon: 'i-lucide-list', badge: data.value?.stats.total ?? 0 },
  { label: t('deckStudy.tabFlashcards'), value: 'flashcards', icon: 'i-lucide-gallery-horizontal-end' }
])

// ---- Word List Filter & Self-Test Hide Mode ----
const search = ref('')
const filter = ref<'all' | 'due' | 'new' | 'learning' | 'known'>('all')
const hideMeanings = ref(false)
const revealed = ref<Set<string>>(new Set())

watch(hideMeanings, () => {
  revealed.value = new Set()
})

function toggleReveal(id: string) {
  const next = new Set(revealed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  revealed.value = next
}

const filteredCards = computed(() => {
  const list = data.value?.cards ?? []
  const q = search.value.trim().toLowerCase()
  return list.filter((c) => {
    if (filter.value === 'due' && !c.due) return false
    if (filter.value === 'new' && c.status !== 'new') return false
    if (filter.value === 'learning' && c.status !== 'learning') return false
    if (filter.value === 'known' && c.status !== 'known') return false
    if (!q) return true
    return (
      c.term.toLowerCase().includes(q)
      || c.definition.toLowerCase().includes(q)
      || (c.translationUz ?? '').toLowerCase().includes(q)
      || (c.translationRu ?? '').toLowerCase().includes(q)
    )
  })
})

// ---- Flashcards Warm-up Mode ----
const flashOrder = ref<DeckWordItem[]>([])
const flashIndex = ref(0)
const flashFlipped = ref(false)

watch(() => data.value?.cards, (cards) => {
  flashOrder.value = [...(cards ?? [])]
  flashIndex.value = 0
  flashFlipped.value = false
}, { immediate: true })

const activeCard = computed(() => flashOrder.value[flashIndex.value] ?? null)
const flashProgress = computed(() => {
  if (!flashOrder.value.length) return 0
  return Math.round(((flashIndex.value + 1) / flashOrder.value.length) * 100)
})

function prevCard() {
  if (flashIndex.value <= 0) return
  flashIndex.value--
  flashFlipped.value = false
}

function nextCard() {
  if (flashIndex.value >= flashOrder.value.length - 1) return
  flashIndex.value++
  flashFlipped.value = false
}

function shuffleFlashcards() {
  const arr = [...flashOrder.value]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  flashOrder.value = arr
  flashIndex.value = 0
  flashFlipped.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (mode.value !== 'flashcards' || !activeCard.value) return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.code === 'Space') {
    e.preventDefault()
    flashFlipped.value = !flashFlipped.value
  } else if (e.key === 'ArrowRight') {
    nextCard()
  } else if (e.key === 'ArrowLeft') {
    prevCard()
  } else if (e.key.toLowerCase() === 'r') {
    speak(activeCard.value.term)
  }
}

onMounted(() => {
  canSpeak.value = canSpeakWords()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stopSpeaking()
})
</script>

<template>
  <AppPage
    :title="data?.deck.title || t('words.tabDecks')"
    back="/words?tab=decks"
    icon="i-lucide-layers"
    wide
  >
    <UContainer class="max-w-4xl px-0 pb-16 lg:pb-0 flex flex-col gap-4 sm:gap-5 min-w-0">
      <USkeleton
        v-if="status === 'pending' && !data"
        class="h-48 w-full rounded-2xl"
      />

      <template v-else-if="data">
        <UBreadcrumb
          :items="breadcrumbs"
          class="max-sm:hidden"
        />

        <UPageHeader
          :title="data.deck.title"
          :description="data.deck.description || t('deckStudy.guidebookHint')"
          :ui="{
            root: 'border-0 py-0',
            wrapper: 'min-w-0',
            title: 'text-xl sm:text-3xl break-words',
            description: 'text-sm mt-1.5',
            links: 'w-full sm:w-auto'
          }"
        >
          <template #headline>
            <UPageList class="flex-row flex-wrap items-center gap-1.5">
              <UBadge
                v-if="data.deck.level"
                :label="data.deck.level"
                color="primary"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="data.deck.category"
                :label="data.deck.category"
                color="neutral"
                variant="outline"
                size="sm"
              />
              <UBadge
                v-if="data.deck.topic"
                :label="data.deck.topic"
                color="neutral"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="data.deck.teacher"
                icon="i-lucide-user"
                :label="data.deck.teacher"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </UPageList>
          </template>
          <template #links>
            <UButton
              v-if="data.stats.total"
              :to="playPath"
              :label="t('deckStudy.startPlaying')"
              icon="i-lucide-gamepad-2"
              size="md"
              class="w-full sm:w-auto justify-center"
              data-testid="deck-start-play"
            />
          </template>
        </UPageHeader>

        <!-- Mastery Progress & Stat Tiles -->
        <UPageGrid class="grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <StatTile
            :label="t('words.statTotal')"
            :value="data.stats.total"
            icon="i-lucide-layers"
            color="primary"
          />
          <StatTile
            :label="t('words.showNew')"
            :value="data.stats.newCount"
            icon="i-lucide-sparkles"
            color="info"
          />
          <StatTile
            :label="t('words.showLearning')"
            :value="data.stats.learning"
            icon="i-lucide-flame"
            color="warning"
          />
          <StatTile
            :label="t('words.showKnown')"
            :value="data.stats.known"
            icon="i-lucide-circle-check"
            color="success"
          />
        </UPageGrid>

        <UCard
          v-if="data.stats.total"
          variant="subtle"
          :ui="{ body: 'flex flex-col gap-2.5' }"
        >
          <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
            <UBadge
              :label="t('deckStudy.masteryProgress', { known: data.stats.known, total: data.stats.total })"
              icon="i-lucide-trophy"
              color="success"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="data.stats.due > 0"
              :label="t('deckStudy.dueBadge', { n: data.stats.due })"
              icon="i-lucide-zap"
              color="primary"
              variant="soft"
              size="sm"
            />
          </UPageList>
          <UProgress
            :model-value="masteryPct"
            color="success"
            size="md"
            status
          />
        </UCard>

        <!-- Empty Deck -->
        <UCard v-if="!data.cards.length">
          <UEmpty
            icon="i-lucide-layers"
            :title="t('deckStudy.emptyDeck')"
            :actions="[{ label: t('deckStudy.backToDecks'), icon: 'i-lucide-arrow-left', to: '/words?tab=decks', color: 'neutral', variant: 'outline' }]"
          />
        </UCard>

        <!-- Study Tabs: Word List & Flashcards -->
        <template v-else>
          <UTabs
            v-model="mode"
            :items="modeTabs"
            variant="pill"
            :content="false"
            class="w-full sm:w-fit"
          />

          <!-- TAB 1: Word List for Memorizing -->
          <template v-if="mode === 'list'">
            <UCard
              variant="subtle"
              :ui="{ body: 'p-3 sm:p-3.5 flex flex-col gap-3' }"
            >
              <UPageList class="flex-row flex-wrap items-center justify-between gap-3">
                <UInput
                  v-model="search"
                  icon="i-lucide-search"
                  :placeholder="t('deckStudy.searchPlaceholder')"
                  class="w-full sm:w-72"
                />
                <USwitch
                  v-model="hideMeanings"
                  :label="t('deckStudy.hideMeanings')"
                />
              </UPageList>

              <UPageList class="flex-row flex-wrap items-center gap-1.5">
                <UButton
                  :label="`${t('words.showAll')} (${data.stats.total})`"
                  :color="filter === 'all' ? 'primary' : 'neutral'"
                  :variant="filter === 'all' ? 'solid' : 'outline'"
                  size="xs"
                  @click="filter = 'all'"
                />
                <UButton
                  :label="`${t('words.showDue')} (${data.stats.due})`"
                  :color="filter === 'due' ? 'primary' : 'neutral'"
                  :variant="filter === 'due' ? 'solid' : 'outline'"
                  size="xs"
                  @click="filter = 'due'"
                />
                <UButton
                  :label="`${t('words.showNew')} (${data.stats.newCount})`"
                  :color="filter === 'new' ? 'info' : 'neutral'"
                  :variant="filter === 'new' ? 'solid' : 'outline'"
                  size="xs"
                  @click="filter = 'new'"
                />
                <UButton
                  :label="`${t('words.showLearning')} (${data.stats.learning})`"
                  :color="filter === 'learning' ? 'warning' : 'neutral'"
                  :variant="filter === 'learning' ? 'solid' : 'outline'"
                  size="xs"
                  @click="filter = 'learning'"
                />
                <UButton
                  :label="`${t('words.showKnown')} (${data.stats.known})`"
                  :color="filter === 'known' ? 'success' : 'neutral'"
                  :variant="filter === 'known' ? 'solid' : 'outline'"
                  size="xs"
                  @click="filter = 'known'"
                />
              </UPageList>
            </UCard>

            <UPageList
              v-if="filteredCards.length"
              class="gap-3"
              data-testid="deck-word-list"
            >
              <UCard
                v-for="(card, idx) in filteredCards"
                :key="card.id"
                variant="outline"
                :ui="{
                  header: 'flex items-start justify-between gap-2 p-3.5 sm:p-4',
                  body: 'flex flex-col gap-2.5 p-3.5 sm:p-4'
                }"
              >
                <template #header>
                  <UUser
                    :name="`${idx + 1}. ${card.term}`"
                    :description="[card.ipa, card.partOfSpeech].filter(Boolean).join(' · ') || undefined"
                    :avatar="{
                      icon: statusBadge(card).icon,
                      ui: card.status === 'known'
                        ? { root: 'bg-success/15', icon: 'text-success' }
                        : card.status === 'learning'
                          ? { root: 'bg-warning/15', icon: 'text-warning' }
                          : { root: 'bg-info/15', icon: 'text-info' }
                    }"
                    size="sm"
                    class="min-w-0 flex-1"
                    :ui="{ wrapper: 'min-w-0', name: 'break-words', description: 'break-words' }"
                  />
                  <UPageList class="flex-row items-center gap-1.5 shrink-0">
                    <UButton
                      v-if="canSpeak"
                      icon="i-lucide-volume-2"
                      :aria-label="t('deckStudy.listen')"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      square
                      @click="speak(card.term)"
                    />
                    <UBadge
                      :label="statusBadge(card).label"
                      :color="statusBadge(card).color"
                      variant="soft"
                      size="xs"
                    />
                    <UButton
                      v-if="hideMeanings && revealed.has(card.id)"
                      :label="t('deckStudy.hideMeaning')"
                      icon="i-lucide-eye-off"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="toggleReveal(card.id)"
                    />
                  </UPageList>
                </template>

                <template v-if="!hideMeanings || revealed.has(card.id)">
                  <UBadge
                    v-if="translationOf(card)"
                    :label="translationOf(card)!"
                    color="primary"
                    variant="subtle"
                    size="md"
                    class="self-start max-w-full"
                    :ui="{ label: 'whitespace-normal text-start' }"
                  />
                  <UPageHeader
                    :description="card.definition"
                    :ui="{ root: 'border-0 py-0', description: 'text-sm text-highlighted mt-0 break-words' }"
                  />
                  <UAlert
                    v-if="card.example"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-quote"
                    :description="card.example"
                  />
                </template>

                <UButton
                  v-else
                  :label="t('deckStudy.revealMeaning')"
                  icon="i-lucide-eye"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  block
                  @click="toggleReveal(card.id)"
                />
              </UCard>
            </UPageList>

            <UCard v-else>
              <UEmpty
                icon="i-lucide-search-x"
                :title="t('deckStudy.noMatching')"
                variant="naked"
              />
            </UCard>
          </template>

          <!-- TAB 2: Interactive Flashcards Warm-up -->
          <template v-else-if="activeCard">
            <UCard
              variant="subtle"
              :ui="{ body: 'p-3.5 sm:p-4 flex flex-col gap-2.5' }"
            >
              <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
                <UBadge
                  :label="t('deckStudy.cardOf', { n: flashIndex + 1, total: flashOrder.length })"
                  color="primary"
                  variant="subtle"
                  size="sm"
                />
                <UPageList class="flex-row items-center gap-1.5">
                  <UButton
                    v-if="canSpeak"
                    :label="t('deckStudy.listen')"
                    icon="i-lucide-volume-2"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    @click="speak(activeCard.term)"
                  />
                  <UButton
                    :label="t('deckStudy.shuffle')"
                    icon="i-lucide-shuffle"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    @click="shuffleFlashcards"
                  />
                </UPageList>
              </UPageList>
              <UProgress
                :model-value="flashProgress"
                color="primary"
                size="sm"
              />
            </UCard>

            <UCard
              variant="outline"
              :ui="{
                header: 'flex items-center justify-between gap-2 p-3.5 sm:p-4',
                body: 'py-7 px-4 sm:py-10 sm:px-6 flex flex-col items-center text-center gap-4 min-h-56 sm:min-h-64 justify-center',
                footer: 'grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-2 p-3.5 sm:p-4'
              }"
            >
              <template #header>
                <UPageList class="flex-row flex-wrap items-center gap-1.5 min-w-0">
                  <UBadge
                    v-if="activeCard.partOfSpeech"
                    :label="activeCard.partOfSpeech"
                    color="neutral"
                    variant="outline"
                    size="xs"
                  />
                  <UBadge
                    :label="statusBadge(activeCard).label"
                    :color="statusBadge(activeCard).color"
                    variant="soft"
                    size="xs"
                  />
                </UPageList>
                <UButton
                  v-if="canSpeak"
                  icon="i-lucide-volume-2"
                  :aria-label="t('deckStudy.listen')"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  square
                  class="shrink-0"
                  @click="speak(activeCard.term)"
                />
              </template>

              <UPageHeader
                :title="activeCard.term"
                :description="activeCard.ipa || undefined"
                :ui="{
                  root: 'border-0 py-0 text-center w-full',
                  container: 'items-center',
                  wrapper: 'min-w-0 w-full',
                  title: 'text-2xl sm:text-4xl break-words',
                  description: 'text-sm mt-1 break-words'
                }"
              />

              <template v-if="flashFlipped">
                <USeparator class="max-w-md" />
                <UBadge
                  v-if="translationOf(activeCard)"
                  :label="translationOf(activeCard)!"
                  color="primary"
                  variant="soft"
                  size="lg"
                  class="max-w-full"
                  :ui="{ label: 'whitespace-normal text-center' }"
                />
                <UPageHeader
                  :description="activeCard.definition"
                  :ui="{
                    root: 'border-0 py-0 text-center w-full max-w-xl',
                    container: 'items-center',
                    wrapper: 'min-w-0 w-full',
                    description: 'text-sm sm:text-base text-highlighted mt-0 break-words'
                  }"
                />
                <UAlert
                  v-if="activeCard.example"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-quote"
                  :description="activeCard.example"
                  class="w-full max-w-xl text-start"
                />
              </template>

              <UButton
                v-else
                :label="t('deckStudy.tapToFlip')"
                icon="i-lucide-rotate-cw"
                color="primary"
                variant="soft"
                size="md"
                class="max-w-full"
                :ui="{ base: 'h-auto py-2.5 px-4', label: 'whitespace-normal text-center leading-snug' }"
                @click="flashFlipped = true"
              />

              <template #footer>
                <UButton
                  :label="t('deckStudy.flip')"
                  icon="i-lucide-rotate-cw"
                  color="neutral"
                  variant="outline"
                  class="col-span-2 sm:col-span-1 sm:order-2 justify-center"
                  @click="flashFlipped = !flashFlipped"
                />
                <UButton
                  :label="t('deckStudy.prev')"
                  icon="i-lucide-arrow-left"
                  color="neutral"
                  variant="ghost"
                  class="sm:order-1 justify-center"
                  :disabled="flashIndex === 0"
                  @click="prevCard"
                />
                <UButton
                  :label="t('deckStudy.next')"
                  trailing-icon="i-lucide-arrow-right"
                  color="primary"
                  class="sm:order-3 justify-center"
                  :disabled="flashIndex >= flashOrder.length - 1"
                  @click="nextCard"
                />
              </template>
            </UCard>
          </template>
        </template>

        <!-- Bottom Back Link -->
        <USeparator />

        <UPageList class="flex-row items-center">
          <UButton
            to="/words?tab=decks"
            :label="t('deckStudy.backToDecks')"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
          />
        </UPageList>
      </template>
    </UContainer>
  </AppPage>
</template>
