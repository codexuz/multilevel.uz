<script setup lang="ts">
import type { Part } from '~/types/ielts'

/**
 * Under a reviewed Listening or Reading part with questions nobody has explained yet: a Premium
 * candidate (or staff) asks the AI once, the explanations are saved with the questions, and the
 * review shows them (and everyone after reads them for free).
 */
const props = defineProps<{ attemptId?: string | null, part: Part, locked?: number }>()
const { t } = useI18n()
const toast = useToast()
const { isPremium, isStaff } = useMe()
const { data: ai } = useFetch<{ enabled: boolean }>('/api/ai/status', { key: 'ai-status' })
const missing = computed(() => (props.part.groups ?? []).flatMap(g => g.items).filter(i => !i.explanation?.trim()).length)
const shown = computed(() => !!props.attemptId && !!ai.value?.enabled && (isPremium.value || isStaff.value) && !props.locked && missing.value > 0)
const busy = ref(false)
async function explain() {
  busy.value = true
  try {
    await $fetch(`/api/attempts/${props.attemptId}/explain`, { method: 'POST', body: { partId: props.part.id } })
    await refreshNuxtData()
  } catch (e) {
    toast.add({ title: t('explain.failed'), description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="shown"
    class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 border-b border-default bg-primary/5 text-sm"
    data-testid="explain-bar"
  >
    <UIcon
      name="i-lucide-sparkles"
      class="size-4 text-primary shrink-0"
    />
    <span class="text-toned flex-1 min-w-48">{{ t('explain.missing', { n: missing }, missing) }}</span>
    <UButton
      :label="busy ? t('explain.writing') : t('explain.ask')"
      icon="i-lucide-wand-sparkles"
      size="xs"
      :loading="busy"
      @click="explain"
    />
  </div>
</template>
