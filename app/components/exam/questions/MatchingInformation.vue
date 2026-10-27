<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { IELTSSubQuestion } from '~/types/ielts'
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const labels = computed(() => {
  const q = props.question
  if (q.options?.length) return [...q.options].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map(o => o.optionKey)
  if (q.headingOptions) return sortKeys(Object.keys(q.headingOptions))
  return ['A', 'B', 'C', 'D', 'E', 'F']
})

const columns = computed<TableColumn<IELTSSubQuestion>[]>(() => [
  { id: 'statement', header: '', meta: { class: { td: 'whitespace-normal min-w-56' } } },
  ...labels.value.map(l => ({ id: `opt_${l}`, header: l, meta: { class: { th: 'text-center', td: 'text-center px-1' } } }))
])

function cellColor(sub: IELTSSubQuestion, label: string) {
  const selected = props.answers[sub.questionNumber ?? 0] === label
  if (props.showResults) {
    if (selected) return sub.correctAnswer === label ? 'success' : 'error'
    return sub.correctAnswer === label ? 'success' : 'neutral'
  }
  return selected ? 'primary' : 'neutral'
}
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTable
        :data="question.questions ?? []"
        :columns="columns"
        :ui="{ thead: 'bg-elevated', th: 'font-bold' }"
      >
        <template #statement-cell="{ row }">
          <span
            :id="`question-${row.original.questionNumber}`"
            class="font-bold text-primary me-2"
          >{{ row.original.questionNumber }}.</span>{{ withoutGapMarks(row.original.questionText ?? '') }}
        </template>
        <template
          v-for="l in labels"
          :key="l"
          #[`opt_${l}-cell`]="{ row }"
        >
          <UButton
            :icon="answers[row.original.questionNumber ?? 0] === l ? 'i-lucide-circle-dot' : 'i-lucide-circle'"
            :color="cellColor(row.original, l)"
            :variant="answers[row.original.questionNumber ?? 0] === l ? 'soft' : 'ghost'"
            :disabled="disabled"
            size="sm"
            square
            class="rounded-full disabled:opacity-100"
            :aria-label="`Question ${row.original.questionNumber}: ${l}`"
            @click="emit('answer', row.original.questionNumber ?? 0, l)"
          />
        </template>
      </UTable>
    </UCard>
  </div>
</template>
