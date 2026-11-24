<script setup lang="ts">
import type { SavedWord } from '~/utils/words'

/**
 * The words a student saved while sitting a test (kept quietly then, so the test stays like the
 * real one), shown with what they mean on its result page.
 */
const props = defineProps<{ attemptId: string }>()
const { t } = useI18n()
const toast = useToast()

const { data, refresh } = await useFetch<{ items: SavedWord[], total: number }>('/api/me/words', {
  query: { attempt: props.attemptId, pageSize: 200 },
  server: false,
  default: () => ({ items: [], total: 0 })
})
// Saved just before the hand-in: their meanings may still be being written.
const waiting = computed(() => data.value.items.some(w => !w.definition))
let tries = 0
watch(waiting, (w) => {
  if (w && tries++ < 3) setTimeout(refresh, 4000)
})

async function remove(id: string) {
  try {
    await $fetch(`/api/me/words/${id}`, { method: 'DELETE' })
    data.value = { ...data.value, items: data.value.items.filter(w => w.id !== id), total: data.value.total - 1 }
  } catch (e: any) {
    toast.add({ title: t('words.notRemoved'), description: e?.data?.message, color: 'error' })
  }
}
</script>

<template>
  <UCard
    v-if="data.items.length"
    data-testid="words-from-attempt"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-book-check"
          class="text-primary"
        />
        <span class="font-semibold">{{ t('words.fromTest', { n: data.items.length }, data.items.length) }}</span>
        <UButton
          to="/words/review"
          :label="t('words.practiseNow')"
          icon="i-lucide-layers"
          size="sm"
          class="ms-auto"
        />
      </div>
      <p class="text-sm text-muted mt-1">
        {{ t('words.fromTestText') }}
      </p>
    </template>
    <div class="grid gap-4 sm:grid-cols-2">
      <div
        v-for="w in data.items"
        :key="w.id"
        class="rounded-lg border border-default p-3"
      >
        <WordsCard
          :word="w"
          @remove="remove(w.id)"
        />
      </div>
    </div>
  </UCard>
</template>
