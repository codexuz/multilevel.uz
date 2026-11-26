<script setup lang="ts">
import type { GameCard } from '~/components/game/Play.vue'
import type { SavedWord } from '~/utils/words'

/**
 * A round of word games: my saved words (due first, else the next to come back), or a deck my teacher
 * set (?deck=). Saved words report each answer as it comes (it moves them on the review schedule);
 * a deck reports the round at its end. The XP earned shows on the end screen.
 */
definePageMeta({ layout: 'game' })
const { t, locale } = useI18n()
const route = useRoute()
const toast = useToast()
useSeoMeta({ title: () => t('game.title'), robots: 'noindex' })

const deckId = computed(() => (typeof route.query.deck === 'string' ? route.query.deck : null))
const title = ref('')
const cards = ref<GameCard[]>([])
const pool = ref<GameCard[]>([])
const xpEarned = ref<number | null>(null)
const loading = ref(true)
const empty = ref(false)
const ROUND = 8
let pending: Promise<unknown>[] = []
let gained = 0

interface DeckCard { id: string, term: string, definition: string, example: string | null, ipa: string | null, partOfSpeech: string | null, translationUz: string | null, translationRu: string | null, isNew?: boolean }
const translationOf = (c: { translationUz?: string | null, translationRu?: string | null }) => (locale.value === 'uz' ? c.translationUz : locale.value === 'ru' ? c.translationRu : null) ?? null
const fromDeck = (c: DeckCard): GameCard => ({ id: c.id, term: c.term, definition: c.definition, example: c.example, ipa: c.ipa, partOfSpeech: c.partOfSpeech, translation: translationOf(c), isNew: c.isNew })
const fromSaved = (w: SavedWord): GameCard | null => (w.definition ? { id: w.id, term: w.word, definition: w.definition, translation: w.translation, example: w.sentence, partOfSpeech: w.partOfSpeech, isNew: w.box === 0 } : null)

async function load() {
  loading.value = true
  xpEarned.value = null
  gained = 0
  pending = []
  try {
    if (deckId.value) {
      const r = await $fetch<{ deck: { title: string }, round: DeckCard[], pool: DeckCard[] }>(`/api/me/decks/${deckId.value}/round`)
      title.value = r.deck.title
      cards.value = r.round.map(fromDeck)
      pool.value = r.pool.map(c => fromDeck({ ...c, example: null, ipa: null, partOfSpeech: null }))
    } else {
      const [due, all] = await Promise.all([
        $fetch<{ items: SavedWord[] }>('/api/me/words/due', { query: { ahead: 1, limit: 12, locale: locale.value } }),
        $fetch<{ items: SavedWord[] }>('/api/me/words', { query: { pageSize: 80 } })
      ])
      title.value = t('words.myWords')
      pool.value = all.items.map(fromSaved).filter((c): c is GameCard => !!c)
      // Few words due: make a proper round with others I saved (practice moves them on as well).
      const round = due.items.map(fromSaved).filter((c): c is GameCard => !!c)
      const extra = pool.value.filter(c => !round.some(r => r.id === c.id)).sort(() => Math.random() - 0.5)
      cards.value = [...round, ...extra.slice(0, Math.max(0, ROUND - round.length))]
    }
    empty.value = !cards.value.length
  } catch (e) {
    toast.add({ title: t('words.notLoaded'), description: errorMessage(e), color: 'error' })
    empty.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)

/** Saved words: each answer moves the word on its schedule (and may earn XP) at once. */
function onAnswer(cardId: string, correct: boolean) {
  if (deckId.value) return
  pending.push($fetch<{ xpGained?: number }>(`/api/me/words/${cardId}/quiz`, { method: 'POST', body: { correct } })
    .then(r => (gained += r.xpGained ?? 0)).catch(() => {}))
}
async function onFinish(results: { cardId: string, correct: boolean }[]) {
  try {
    if (deckId.value) {
      const r = await $fetch<{ xpGained: number }>(`/api/me/decks/${deckId.value}/answers`, { method: 'POST', body: { answers: results } })
      xpEarned.value = r.xpGained
    } else {
      await Promise.all(pending)
      xpEarned.value = gained
    }
  } catch (e) {
    xpEarned.value = 0
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
  refreshXp()
}
const closeTo = computed(() => (deckId.value ? `/words/decks/${deckId.value}` : '/words'))
</script>

<template>
  <div
    v-if="loading"
    class="min-h-dvh grid place-items-center"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="size-8 animate-spin text-dimmed"
    />
  </div>
  <div
    v-else-if="empty"
    class="min-h-dvh grid place-items-center px-4"
  >
    <UEmpty
      icon="i-lucide-book-open-text"
      :title="t('game.nothing')"
      :description="deckId ? t('game.nothingDeck') : t('game.nothingSaved')"
      :actions="[{ label: t('game.back'), to: closeTo, icon: 'i-lucide-arrow-left' }]"
    />
  </div>
  <GamePlay
    v-else
    :cards="cards"
    :pool="pool"
    :title="title"
    :close-to="closeTo"
    :xp-earned="xpEarned"
    @answer="onAnswer"
    @finish="onFinish"
    @again="load"
  />
</template>
