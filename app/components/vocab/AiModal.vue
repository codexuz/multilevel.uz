<script setup lang="ts">
import type { VocabCardInput } from '~/utils/vocab'

/**
 * The AI writes cards, the teacher keeps the ones they want. "generate": cards on a topic at a level;
 * "import": the words of a pasted text (a word list, an article, notes). With a deck the kept cards go
 * into it (skipping words it has); without one a new deck is made for them. Emits the deck's id.
 */
const props = defineProps<{
  mode: 'generate' | 'import'
  deckId?: string
  categories: string[]
  defaults?: { topic?: string | null, category?: string | null, level?: string | null }
}>()
const emit = defineEmits<{ done: [deckId: string, added: number] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const form = reactive({ topic: '', category: '', level: 'B1', count: 15, text: '', max: 30, title: '' })
const drafts = ref<(VocabCardInput & { keep: boolean })[]>([])
const busy = ref(false)
const saving = ref(false)
watch(open, (o) => {
  if (!o) return
  drafts.value = []
  form.topic = props.defaults?.topic ?? ''
  form.category = props.defaults?.category ?? ''
  form.level = props.defaults?.level ?? 'B1'
  form.text = ''
  form.title = ''
})

const levelItems = VOCAB_LEVELS.map(l => ({ label: l, value: l as string }))
const categoryItems = computed(() => props.categories)
const kept = computed(() => drafts.value.filter(d => d.keep))
const canAsk = computed(() => (props.mode === 'generate' ? form.topic.trim().length > 1 : form.text.trim().length > 2))

async function ask() {
  if (!canAsk.value) return
  busy.value = true
  try {
    const r = props.mode === 'generate'
      ? await $fetch<{ cards: VocabCardInput[] }>('/api/vocab/ai/generate', { method: 'POST', body: { topic: form.topic, category: form.category || null, level: form.level, count: form.count, deckId: props.deckId } })
      : await $fetch<{ cards: VocabCardInput[] }>('/api/vocab/ai/import', { method: 'POST', body: { text: form.text, level: form.level, max: form.max } })
    // A second ask adds what is new under the cards already drafted.
    const have = new Set(drafts.value.map(d => d.term.toLowerCase()))
    drafts.value.push(...r.cards.filter(c => !have.has(c.term.toLowerCase())).map(c => ({ ...c, keep: true })))
    if (!form.title) form.title = props.mode === 'generate' ? form.topic.trim() : t('vocab.importedTitle')
  } catch (e) {
    toast.add({ title: t('vocab.aiFailed'), description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function save() {
  if (!kept.value.length) return
  saving.value = true
  try {
    let id = props.deckId
    if (!id) {
      const deck = await $fetch<{ id: string }>('/api/vocab/decks', {
        method: 'POST',
        body: { title: form.title.trim() || form.topic.trim() || t('vocab.untitled'), category: form.category || null, topic: props.mode === 'generate' ? form.topic.trim() : null, level: form.level }
      })
      id = deck.id
    }
    const r = await $fetch<{ added: number }>(`/api/vocab/decks/${id}/cards`, { method: 'POST', body: { cards: kept.value.map(({ keep: _k, ...c }) => c) } })
    toast.add({ title: t('vocab.cardsAdded', { n: r.added }, r.added), color: 'success', icon: 'i-lucide-check' })
    open.value = false
    emit('done', id, r.added)
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
const allKept = computed({
  get: () => drafts.value.length > 0 && drafts.value.every(d => d.keep),
  set: v => drafts.value.forEach(d => (d.keep = v))
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="mode === 'generate' ? t('vocab.aiCreate') : t('vocab.aiImport')"
    :description="mode === 'generate' ? t('vocab.aiCreateText') : t('vocab.aiImportText')"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div
          v-if="mode === 'generate'"
          class="grid grid-cols-2 sm:grid-cols-[1fr_7rem_8rem] gap-3"
        >
          <UFormField
            :label="t('vocab.topic')"
            required
            class="col-span-2 sm:col-span-3"
          >
            <UInput
              v-model="form.topic"
              :placeholder="t('vocab.topicPlaceholder')"
              class="w-full"
              autofocus
              data-testid="ai-topic"
              @keydown.enter.prevent="ask"
            />
          </UFormField>
          <UFormField
            :label="t('vocab.category')"
            class="col-span-2 sm:col-span-1"
          >
            <UInputMenu
              v-model="form.category"
              :items="categoryItems"
              create-item
              :placeholder="t('vocab.categoryPlaceholder')"
              class="w-full"
              @create="(v: string) => (form.category = v)"
            />
          </UFormField>
          <div class="contents">
            <UFormField :label="t('vocab.level')">
              <USelect
                v-model="form.level"
                :items="levelItems"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('vocab.count')">
              <UInputNumber
                v-model="form.count"
                :min="5"
                :max="40"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
        <div
          v-else
          class="flex flex-col gap-3"
        >
          <UFormField
            :label="t('vocab.pasteText')"
            :hint="`${form.text.length} / 20000`"
            required
          >
            <UTextarea
              v-model="form.text"
              :rows="7"
              :maxlength="20000"
              :placeholder="t('vocab.pastePlaceholder')"
              class="w-full"
              autofocus
              data-testid="ai-text"
            />
          </UFormField>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <UFormField :label="t('vocab.level')">
              <USelect
                v-model="form.level"
                :items="levelItems"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('vocab.maxWords')">
              <UInputNumber
                v-model="form.max"
                :min="5"
                :max="60"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="!deckId"
              :label="t('vocab.category')"
              class="col-span-2 sm:col-span-1"
            >
              <UInputMenu
                v-model="form.category"
                :items="categoryItems"
                create-item
                class="w-full"
                @create="(v: string) => (form.category = v)"
              />
            </UFormField>
          </div>
        </div>

        <UButton
          :label="drafts.length ? t('vocab.askMore') : (mode === 'generate' ? t('vocab.generate') : t('vocab.findWords'))"
          icon="i-lucide-sparkles"
          :loading="busy"
          :disabled="!canAsk"
          :variant="drafts.length ? 'outline' : 'solid'"
          :color="drafts.length ? 'neutral' : 'primary'"
          class="self-start"
          data-testid="ai-ask"
          @click="ask"
        />

        <div
          v-if="busy && !drafts.length"
          class="grid gap-2"
        >
          <USkeleton
            v-for="i in 4"
            :key="i"
            class="h-14 rounded-lg"
          />
        </div>

        <template v-if="drafts.length">
          <div class="flex items-center justify-between gap-2">
            <UCheckbox
              v-model="allKept"
              :label="t('vocab.keepCount', { n: kept.length, total: drafts.length })"
            />
            <p class="text-xs text-muted">
              {{ t('vocab.reviewHint') }}
            </p>
          </div>
          <ul
            class="rounded-lg ring-2 ring-default divide-y-2 divide-default max-h-[45vh] overflow-y-auto"
            data-testid="ai-drafts"
          >
            <li
              v-for="(d, i) in drafts"
              :key="d.term + i"
              class="flex gap-3 p-3"
              :class="d.keep ? '' : 'opacity-50'"
            >
              <UCheckbox
                v-model="d.keep"
                class="mt-1"
                :aria-label="d.term"
              />
              <div class="min-w-0 flex-1 grid sm:grid-cols-[12rem_1fr] gap-x-3 gap-y-1">
                <div class="min-w-0">
                  <UInput
                    v-model="d.term"
                    size="sm"
                    variant="soft"
                    class="w-full font-extrabold"
                  />
                  <p class="text-xs text-muted mt-1 truncate">
                    {{ [d.partOfSpeech, d.ipa].filter(Boolean).join(' · ') }}
                  </p>
                </div>
                <div class="min-w-0 flex flex-col gap-1">
                  <UInput
                    v-model="d.definition"
                    size="sm"
                    variant="soft"
                    class="w-full"
                  />
                  <p
                    v-if="d.example"
                    class="text-xs text-muted italic line-clamp-2"
                  >
                    {{ d.example }}
                  </p>
                  <p class="text-xs text-toned">
                    <span v-if="d.translationUz">uz: {{ d.translationUz }}</span>
                    <span v-if="d.translationRu"> · ru: {{ d.translationRu }}</span>
                  </p>
                </div>
              </div>
            </li>
          </ul>
          <UFormField
            v-if="!deckId"
            :label="t('vocab.deckTitle')"
          >
            <UInput
              v-model="form.title"
              class="w-full"
              data-testid="ai-title"
            />
          </UFormField>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          :label="deckId ? t('vocab.addToDeck', { n: kept.length }) : t('vocab.saveDeck', { n: kept.length })"
          icon="i-lucide-check"
          :loading="saving"
          :disabled="!kept.length"
          data-testid="ai-save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
