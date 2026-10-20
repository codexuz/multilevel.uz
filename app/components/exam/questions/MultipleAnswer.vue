<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const range = computed(() => getQuestionRange(props.question))
const subNums = computed(() => (props.question.questions ?? []).map(s => s.questionNumber ?? 0).sort((a, b) => a - b))
const maxSelections = computed(() => subNums.value.length || 1)
const ownNum = computed(() => props.question.questionNumber ?? range.value[0])

const selectedKeys = computed(() => {
  if (subNums.value.length) return subNums.value.map(n => props.answers[n]).filter(Boolean) as string[]
  return (props.answers[ownNum.value] ?? '').split(',').filter(Boolean)
})
const atLimit = computed(() => selectedKeys.value.length >= maxSelections.value)

const options = computed(() => [...(props.question.options ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)))
const questionText = computed(() => props.question.questions?.find(s => s.questionText)?.questionText ?? props.question.questionText ?? '')

function toggle(key: string) {
  if (props.disabled) return
  let next: string[]
  if (selectedKeys.value.includes(key)) next = selectedKeys.value.filter(k => k !== key)
  else {
    if (atLimit.value) return
    next = [...selectedKeys.value, key]
  }
  if (subNums.value.length) subNums.value.forEach((n, i) => emit('answer', n, next[i] ?? ''))
  else emit('answer', ownNum.value, [...next].sort().join(','))
}

function color(o: { optionKey: string, isCorrect: boolean }) {
  const selected = selectedKeys.value.includes(o.optionKey)
  if (props.showResults) return o.isCorrect ? 'success' : selected ? 'error' : 'neutral'
  return selected ? 'primary' : 'neutral'
}
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />
    <div
      v-if="questionText"
      class="rich-content font-medium mb-3"
      v-html="questionText"
    />
    <div
      :id="`question-${subNums[0] ?? ownNum}`"
      class="flex flex-col divide-y divide-default"
    >
      <UCheckbox
        v-for="o in options"
        :key="o.optionKey"
        :model-value="selectedKeys.includes(o.optionKey)"
        :label="`${o.optionKey}  ${o.optionText}`"
        :color="color(o) === 'neutral' ? 'primary' : color(o)"
        :disabled="disabled || (!selectedKeys.includes(o.optionKey) && atLimit && !showResults)"
        variant="list"
        :class="['py-2.5 px-3 rounded-md', showResults && o.isCorrect ? 'bg-success/10' : showResults && selectedKeys.includes(o.optionKey) ? 'bg-error/10' : '']"
        @update:model-value="toggle(o.optionKey)"
      />
    </div>
  </div>
</template>
