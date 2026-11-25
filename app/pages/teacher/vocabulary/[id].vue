<script setup lang="ts">
import type { VocabCard, VocabDeck } from '~/utils/vocab'

/**
 * A deck's editor: its name, category, topic and level; the classes that study it; and its cards,
 * written by hand or added by the AI (from a topic or a pasted text), each to edit or remove.
 */
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const { confirm } = useDialogs()
const id = computed(() => String(route.params.id))

interface FullDeck extends VocabDeck { cards: VocabCard[], classIds: string[] }
const { data: deck, refresh, error } = await useFetch<FullDeck>(() => `/api/vocab/decks/${id.value}`)
if (error.value) throw createError({ statusCode: 404, message: t('vocab.notFound'), fatal: true })
const { data: meta } = await useFetch<{ categories: string[] }>('/api/vocab/decks', { default: () => ({ categories: [] }), transform: r => ({ categories: r.categories }) })
const { data: myClasses } = await useFetch<{ classes: { id: string, name: string, archived: boolean, students: number }[] }>('/api/classes', { default: () => ({ classes: [] }) })
useSeoMeta({ title: () => deck.value?.title ?? t('vocab.title'), robots: 'noindex' })

// ----- the deck's details -----
const form = reactive({ title: '', description: '', category: '', topic: '', level: '' })
watch(deck, (d) => {
  if (d) Object.assign(form, { title: d.title, description: d.description ?? '', category: d.category ?? '', topic: d.topic ?? '', level: d.level ?? 'any' })
}, { immediate: true })
const dirty = computed(() => !!deck.value && (form.title !== deck.value.title || form.description !== (deck.value.description ?? '') || form.category !== (deck.value.category ?? '') || form.topic !== (deck.value.topic ?? '') || form.level !== (deck.value.level ?? 'any')))
const savingDetails = ref(false)
async function saveDetails() {
  if (!form.title.trim()) return
  savingDetails.value = true
  try {
    await $fetch(`/api/vocab/decks/${id.value}`, { method: 'PATCH', body: { ...form, level: form.level === 'any' ? null : form.level } })
    await refresh()
    toast.add({ title: t('vocab.saved'), color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    savingDetails.value = false
  }
}
const levelItems = computed(() => [{ label: t('vocab.anyLevel'), value: 'any' }, ...VOCAB_LEVELS.map(l => ({ label: l, value: l as string }))])
const categories = computed(() => [...new Set([...meta.value.categories, ...(form.category ? [form.category] : [])])])

// ----- classes -----
const classItems = computed(() => myClasses.value.classes.filter(c => !c.archived || deck.value?.classIds.includes(c.id)).map(c => ({ label: c.name, value: c.id, description: t('vocab.studentsN', { n: c.students }, c.students) })))
const classIds = ref<string[]>([])
watch(deck, d => (classIds.value = [...(d?.classIds ?? [])]), { immediate: true })
const savingClasses = ref(false)
async function saveClasses(ids: string[]) {
  savingClasses.value = true
  try {
    const r = await $fetch<{ classIds: string[] }>(`/api/vocab/decks/${id.value}/classes`, { method: 'POST', body: { groupIds: ids } })
    classIds.value = r.classIds
    if (deck.value) deck.value.classIds = r.classIds
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
    classIds.value = [...(deck.value?.classIds ?? [])]
  } finally {
    savingClasses.value = false
  }
}

// ----- cards -----
const search = ref('')
const cards = computed(() => {
  const q = search.value.trim().toLowerCase()
  const all = deck.value?.cards ?? []
  return q ? all.filter(c => c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q)) : all
})
const cardOpen = ref(false)
const editing = ref<VocabCard | null>(null)
function editCard(c: VocabCard | null) {
  editing.value = c
  cardOpen.value = true
}
async function removeCard(c: VocabCard) {
  try {
    await $fetch(`/api/vocab/cards/${c.id}`, { method: 'DELETE' })
    if (deck.value) deck.value.cards = deck.value.cards.filter(x => x.id !== c.id)
  } catch (e) {
    toast.add({ title: t('vocab.notRemoved'), description: errorMessage(e), color: 'error' })
  }
}
const aiOpen = ref(false)
const aiMode = ref<'generate' | 'import'>('generate')
function openAi(mode: 'generate' | 'import') {
  aiMode.value = mode
  aiOpen.value = true
}

async function removeDeck() {
  if (!await confirm({ title: t('vocab.deleteDeck'), description: t('vocab.deleteDeckText'), confirmLabel: t('vocab.deleteDeck') })) return
  try {
    await $fetch(`/api/vocab/decks/${id.value}`, { method: 'DELETE' })
    await navigateTo('/teacher/vocabulary')
  } catch (e) {
    toast.add({ title: t('vocab.notRemoved'), description: errorMessage(e), color: 'error' })
  }
}
const say = (text: string) => {
  if (!import.meta.client || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-GB'
  speechSynthesis.speak(u)
}
</script>

<template>
  <AppPage
    v-if="deck"
    :title="deck.title"
    icon="i-lucide-layers"
    back="/teacher/vocabulary"
  >
    <template #actions>
      <UButton
        :label="t('vocab.deleteDeck')"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        data-testid="delete-deck"
        @click="removeDeck"
      />
    </template>

    <div class="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
      <div class="flex flex-col gap-4 min-w-0 order-2 lg:order-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-extrabold text-highlighted me-auto">
            {{ t('vocab.cardCount', { n: deck.cards.length }, deck.cards.length) }}
          </h2>
          <UButton
            :label="t('vocab.addWithAi')"
            icon="i-lucide-sparkles"
            data-testid="deck-ai-generate"
            @click="openAi('generate')"
          />
          <UButton
            :label="t('vocab.aiImport')"
            icon="i-lucide-file-input"
            color="neutral"
            variant="outline"
            data-testid="deck-ai-import"
            @click="openAi('import')"
          />
          <UButton
            :label="t('vocab.newCard')"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            data-testid="deck-new-card"
            @click="editCard(null)"
          />
        </div>
        <UInput
          v-if="deck.cards.length > 8"
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('vocab.searchCards')"
          class="w-full sm:w-72"
        />

        <ul
          v-if="cards.length"
          class="rounded-[var(--card-radius)] ring-2 ring-default divide-y-2 divide-default overflow-hidden bg-default"
          data-testid="deck-cards"
        >
          <li
            v-for="(c, i) in cards"
            :key="c.id"
            class="flex gap-3 p-3 sm:p-4 group"
          >
            <span class="text-xs font-extrabold text-dimmed tabular-nums w-6 pt-1 shrink-0">{{ i + 1 }}</span>
            <div class="min-w-0 flex-1 grid sm:grid-cols-[13rem_1fr] gap-x-4 gap-y-1">
              <div class="min-w-0">
                <p class="font-extrabold text-highlighted flex items-center gap-1">
                  <span class="truncate">{{ c.term }}</span>
                  <UButton
                    icon="i-lucide-volume-2"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t('game.listen')"
                    @click="say(c.term)"
                  />
                </p>
                <p class="text-xs text-muted truncate">
                  {{ [c.partOfSpeech, c.ipa].filter(Boolean).join(' · ') }}
                </p>
              </div>
              <div class="min-w-0">
                <p class="text-sm text-toned">
                  {{ c.definition }}
                </p>
                <p
                  v-if="c.example"
                  class="text-xs text-muted italic mt-0.5"
                >
                  {{ c.example }}
                </p>
                <p
                  v-if="c.translationUz || c.translationRu"
                  class="text-xs text-dimmed mt-0.5"
                >
                  <span v-if="c.translationUz">uz: {{ c.translationUz }}</span>
                  <span v-if="c.translationRu"> · ru: {{ c.translationRu }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-start gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <UButton
                icon="i-lucide-pencil"
                size="sm"
                color="neutral"
                variant="ghost"
                :aria-label="t('common.edit')"
                @click="editCard(c)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="sm"
                color="error"
                variant="ghost"
                :aria-label="t('vocab.removeCard')"
                @click="removeCard(c)"
              />
            </div>
          </li>
        </ul>
        <UEmpty
          v-else-if="!deck.cards.length"
          icon="i-lucide-sparkles"
          :title="t('vocab.noCards')"
          :description="t('vocab.noCardsText')"
          :actions="[{ label: t('vocab.addWithAi'), icon: 'i-lucide-sparkles', onClick: () => openAi('generate') }]"
        />
        <UEmpty
          v-else
          icon="i-lucide-search-x"
          :title="t('vocab.noMatch')"
          variant="naked"
        />
      </div>

      <div class="flex flex-col gap-4 order-1 lg:order-2 lg:sticky lg:top-20">
        <UCard>
          <template #header>
            <p class="font-extrabold text-highlighted flex items-center gap-2">
              <UIcon
                name="i-lucide-users"
                class="size-5 text-primary"
              />{{ t('vocab.setToClasses') }}
            </p>
          </template>
          <USelectMenu
            v-model="classIds"
            :items="classItems"
            value-key="value"
            multiple
            :placeholder="t('vocab.pickClasses')"
            :loading="savingClasses"
            class="w-full"
            data-testid="deck-classes"
            @update:model-value="saveClasses"
          />
          <p class="text-xs text-muted mt-2">
            {{ classItems.length ? t('vocab.classesHint') : t('vocab.noClasses') }}
          </p>
        </UCard>

        <UCard>
          <template #header>
            <p class="font-extrabold text-highlighted">
              {{ t('vocab.details') }}
            </p>
          </template>
          <form
            class="grid gap-3"
            @submit.prevent="saveDetails"
          >
            <UFormField
              :label="t('vocab.deckTitle')"
              required
            >
              <UInput
                v-model="form.title"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('vocab.category')">
              <UInputMenu
                v-model="form.category"
                :items="categories"
                create-item
                class="w-full"
                @create="(v: string) => (form.category = v)"
              />
            </UFormField>
            <UFormField :label="t('vocab.topic')">
              <UInput
                v-model="form.topic"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('vocab.level')">
              <USelect
                v-model="form.level"
                :items="levelItems"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('vocab.description')">
              <UTextarea
                v-model="form.description"
                :rows="2"
                autoresize
                class="w-full"
              />
            </UFormField>
            <UButton
              type="submit"
              :label="t('common.save')"
              :loading="savingDetails"
              :disabled="!dirty || !form.title.trim()"
              block
            />
          </form>
        </UCard>
      </div>
    </div>

    <VocabCardModal
      v-model:open="cardOpen"
      :deck-id="deck.id"
      :card="editing"
      @saved="refresh()"
    />
    <VocabAiModal
      v-model:open="aiOpen"
      :mode="aiMode"
      :deck-id="deck.id"
      :categories="categories"
      :defaults="{ topic: deck.topic, category: deck.category, level: deck.level }"
      @done="refresh()"
    />
  </AppPage>
</template>
