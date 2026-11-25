<script setup lang="ts">
import type { VocabDeck } from '~/utils/vocab'

/**
 * A teacher's vocabulary decks, filed by category and then topic. A new deck opens in its editor,
 * where its cards are made by the AI from its topic, found by the AI in a pasted text, or written by hand.
 */
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
const { t } = useI18n()
const toast = useToast()
useSeoMeta({ title: () => t('vocab.title'), robots: 'noindex' })

interface TeacherDeck extends VocabDeck { cards: number, classes: { id: string, name: string }[] }
const { data, status } = await useFetch<{ decks: TeacherDeck[], categories: string[] }>('/api/vocab/decks', { default: () => ({ decks: [], categories: [] }) })

const search = ref('')
const category = ref<string>('all')
// The built-in categories and any a teacher typed for a deck.
const categories = computed(() => [...new Set([...data.value.categories, ...data.value.decks.map(d => d.category).filter((c): c is string => !!c)])])
const categoryTabs = computed(() => [
  { label: t('vocab.allCategories'), value: 'all' },
  ...categories.value.filter(c => data.value.decks.some(d => d.category === c)).map(c => ({ label: c, value: c })),
  ...(data.value.decks.some(d => !d.category) ? [{ label: t('vocab.noCategory'), value: '' }] : [])
])
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return data.value.decks.filter(d => (category.value === 'all' || (d.category ?? '') === category.value)
    && (!q || d.title.toLowerCase().includes(q) || (d.topic ?? '').toLowerCase().includes(q)))
})
/** Category → topic → decks, in the order the decks were last changed. */
const grouped = computed(() => {
  const out: { category: string, topics: { topic: string, decks: TeacherDeck[] }[] }[] = []
  for (const d of shown.value) {
    const c = d.category || t('vocab.noCategory')
    let g = out.find(x => x.category === c)
    if (!g) out.push(g = { category: c, topics: [] })
    const tp = d.topic || t('vocab.noTopic')
    let tg = g.topics.find(x => x.topic === tp)
    if (!tg) g.topics.push(tg = { topic: tp, decks: [] })
    tg.decks.push(d)
  }
  // Decks without a category come last.
  const other = t('vocab.noCategory')
  return out.sort((a, b) => Number(a.category === other) - Number(b.category === other))
})

const newOpen = ref(false)
const creating = ref(false)
const form = reactive({ title: '', category: '', topic: '', level: 'B1' })
watch(newOpen, o => o && Object.assign(form, { title: '', category: category.value === 'all' ? '' : category.value, topic: '', level: 'B1' }))
async function create() {
  if (!form.title.trim()) return
  creating.value = true
  try {
    const deck = await $fetch<{ id: string }>('/api/vocab/decks', { method: 'POST', body: { ...form, category: form.category || null, topic: form.topic || null } })
    await navigateTo(`/teacher/vocabulary/${deck.id}`)
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    creating.value = false
  }
}
const levelItems = VOCAB_LEVELS.map(l => ({ label: l, value: l as string }))
</script>

<template>
  <AppPage
    :title="t('vocab.title')"
    icon="i-lucide-layers"
  >
    <template #actions>
      <UButton
        :label="t('vocab.newDeck')"
        icon="i-lucide-plus"
        data-testid="new-deck"
        @click="newOpen = true"
      />
    </template>

    <div class="flex flex-col gap-5">
      <template v-if="data.decks.length">
        <div class="flex flex-wrap items-center gap-2">
          <UTabs
            v-model="category"
            :items="categoryTabs"
            :content="false"
            size="sm"
            class="min-w-0 overflow-x-auto"
          />
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('vocab.searchDecks')"
            class="w-full sm:w-64 sm:ms-auto"
          />
        </div>

        <section
          v-for="g in grouped"
          :key="g.category"
          class="flex flex-col gap-3"
        >
          <h2
            v-if="category === 'all'"
            class="text-lg font-extrabold text-highlighted"
          >
            {{ g.category }}
          </h2>
          <div
            v-for="tg in g.topics"
            :key="tg.topic"
            class="flex flex-col gap-2"
          >
            <p class="text-xs font-extrabold uppercase tracking-wide text-muted">
              {{ tg.topic }}
            </p>
            <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <NuxtLink
                v-for="d in tg.decks"
                :key="d.id"
                :to="`/teacher/vocabulary/${d.id}`"
                class="tile p-4 flex flex-col gap-3 text-start hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
                data-testid="deck-card"
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
                    <p class="text-sm text-muted">
                      {{ t('vocab.cardCount', { n: d.cards }, d.cards) }}
                    </p>
                  </div>
                  <UBadge
                    v-if="d.level"
                    :label="d.level"
                    color="neutral"
                    variant="subtle"
                  />
                </div>
                <div class="flex flex-wrap gap-1 min-h-6">
                  <UBadge
                    v-for="c in d.classes"
                    :key="c.id"
                    :label="c.name"
                    icon="i-lucide-users"
                    color="primary"
                    variant="soft"
                    size="sm"
                  />
                  <span
                    v-if="!d.classes.length"
                    class="text-xs text-dimmed"
                  >{{ t('vocab.notSet') }}</span>
                </div>
              </NuxtLink>
            </div>
          </div>
        </section>
        <UEmpty
          v-if="!shown.length"
          icon="i-lucide-search-x"
          :title="t('vocab.noMatch')"
          variant="naked"
        />
      </template>

      <UEmpty
        v-else-if="status !== 'pending'"
        icon="i-lucide-layers"
        :title="t('vocab.emptyTitle')"
        :description="t('vocab.emptyText')"
        :actions="[{ label: t('vocab.newDeck'), icon: 'i-lucide-plus', onClick: () => { newOpen = true } }]"
        data-testid="decks-empty"
      />
    </div>

    <UModal
      v-model:open="newOpen"
      :title="t('vocab.newDeck')"
    >
      <template #body>
        <form
          class="grid gap-3"
          @submit.prevent="create"
        >
          <UFormField
            :label="t('vocab.deckTitle')"
            required
          >
            <UInput
              v-model="form.title"
              class="w-full"
              autofocus
              data-testid="new-deck-title"
            />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-3">
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
                :placeholder="t('vocab.topicPlaceholder')"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField :label="t('vocab.level')">
            <USelect
              v-model="form.level"
              :items="levelItems"
              class="w-40"
            />
          </UFormField>
          <button
            type="submit"
            class="hidden"
          />
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="newOpen = false"
          />
          <UButton
            :label="t('vocab.create')"
            :loading="creating"
            :disabled="!form.title.trim()"
            data-testid="new-deck-save"
            @click="create"
          />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
