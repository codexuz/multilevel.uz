<script setup lang="ts">
import type { IELTSQuestionOption, IELTSQuestionType, IELTSSubQuestion } from '~/types/ielts'

const props = defineProps<{
  type: IELTSQuestionType
  startNumber?: number
  options: IELTSQuestionOption[]
  headings: { key: string, text: string }[]
}>()
const subs = defineModel<IELTSSubQuestion[]>({ required: true })

const mode = computed(() => answerMode(props.type))

const answerItems = computed(() => {
  switch (mode.value) {
    case 'tfng': return ['TRUE', 'FALSE', 'NOT GIVEN'].map(v => ({ label: v, value: v }))
    case 'ynng': return ['YES', 'NO', 'NOT GIVEN'].map(v => ({ label: v, value: v }))
    case 'option-key': return props.options.map(o => ({ label: o.optionText ? `${o.optionKey} – ${o.optionText.slice(0, 30)}` : o.optionKey, value: o.optionKey }))
    case 'heading-key': return props.headings.filter(h => h.key).map(h => ({ label: h.text ? `${h.key} – ${h.text.slice(0, 30)}` : h.key, value: h.key }))
    default: return []
  }
})

const placeholder = computed(() => {
  switch (props.type) {
    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN': return 'Statement text'
    case 'MATCHING_HEADINGS': return 'e.g. Paragraph A'
    case 'MATCHING_INFORMATION': return 'Information to find'
    case 'MATCHING_SENTENCE_ENDINGS': return 'Sentence beginning'
    default: return 'Question / blank text'
  }
})

function add() {
  const base = props.startNumber ?? 1
  const last = subs.value.at(-1)?.questionNumber
  subs.value = [...subs.value, {
    questionNumber: last ? last + 1 : base + subs.value.length,
    questionText: '',
    correctAnswer: '',
    explanation: '',
    fromPassage: '',
    points: 1,
    order: subs.value.length + 1
  }]
}
</script>

<template>
  <UCard
    variant="subtle"
    :ui="{ header: 'py-2.5 sm:px-4', body: 'sm:p-4 space-y-3' }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ subQuestionsLabel(type) }} ({{ subs.length }})</span>
        <UButton
          icon="i-lucide-plus"
          label="Add"
          size="xs"
          variant="soft"
          @click="add"
        />
      </div>
    </template>

    <UCard
      v-for="(sq, i) in subs"
      :key="sq.id ?? i"
      :ui="{ body: 'p-3 sm:p-3 space-y-2' }"
    >
      <div class="flex items-center gap-2">
        <UInputNumber
          v-model="sq.questionNumber"
          :min="1"
          size="sm"
          class="w-24"
          :ui="{ base: 'font-semibold' }"
        />
        <UInput
          v-model="sq.questionText"
          :placeholder="placeholder"
          size="sm"
          class="flex-1"
        />
        <USelect
          v-if="mode !== 'text'"
          v-model="sq.correctAnswer"
          :items="answerItems"
          placeholder="Answer…"
          size="sm"
          class="w-40"
        />
        <UInput
          v-else
          v-model="sq.correctAnswer"
          placeholder="Correct answer"
          size="sm"
          class="w-44"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          aria-label="Remove"
          @click="() => { subs = subs.filter((_, idx) => idx !== i) }"
        />
      </div>
      <div class="grid sm:grid-cols-[1fr_1fr_5rem_5rem] gap-2">
        <UInput
          v-model="sq.explanation"
          placeholder="Explanation"
          size="sm"
        />
        <UInput
          v-model="sq.fromPassage"
          placeholder="From passage"
          size="sm"
        />
        <UInputNumber
          v-model="sq.order"
          :min="1"
          placeholder="Order"
          size="sm"
          orientation="vertical"
        />
        <UInputNumber
          v-model="sq.points"
          :min="0"
          placeholder="Pts"
          size="sm"
          orientation="vertical"
        />
      </div>
    </UCard>
    <p
      v-if="!subs.length"
      class="text-xs text-muted text-center py-2"
    >
      No sub-questions yet. Click “Add” to begin.
    </p>
  </UCard>
</template>
