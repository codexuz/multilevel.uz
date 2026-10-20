<script setup lang="ts">
import type { IELTSQuestionType } from '~/types/ielts'

const props = defineProps<{ type: IELTSQuestionType }>()
const headings = defineModel<{ key: string, text: string }[]>({ required: true })

const isInfo = computed(() => props.type === 'MATCHING_INFORMATION')

function add() {
  headings.value = [...headings.value, { key: nextHeadingKey(props.type, headings.value.length), text: '' }]
}
</script>

<template>
  <UCard
    variant="subtle"
    :ui="{ header: 'py-2.5 sm:px-4', body: 'sm:p-4 space-y-2' }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ isInfo ? 'Paragraph options (A, B, C…)' : 'Heading options (i, ii, iii…)' }}</span>
        <UButton
          icon="i-lucide-plus"
          :label="isInfo ? 'Add paragraph' : 'Add heading'"
          size="xs"
          variant="soft"
          @click="add"
        />
      </div>
    </template>

    <div
      v-for="(h, i) in headings"
      :key="i"
      class="flex items-center gap-2"
    >
      <UInput
        v-model="h.key"
        class="w-16"
        :ui="{ base: 'text-center font-semibold' }"
      />
      <UInput
        v-model="h.text"
        :placeholder="isInfo ? 'Paragraph label' : 'Heading text'"
        class="flex-1"
      />
      <UButton
        icon="i-lucide-x"
        color="error"
        variant="ghost"
        size="sm"
        aria-label="Remove"
        @click="() => { headings = headings.filter((_, idx) => idx !== i) }"
      />
    </div>
    <p
      v-if="!headings.length"
      class="text-xs text-muted text-center py-2"
    >
      {{ isInfo ? 'No paragraphs yet.' : 'No headings yet.' }}
    </p>
  </UCard>
</template>
