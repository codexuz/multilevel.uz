<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const labels = computed(() => {
  const q = props.question
  if (q.options?.length) return [...q.options].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map(o => o.optionKey)
  if (q.headingOptions) return Object.keys(q.headingOptions).sort()
  return ['A', 'B', 'C', 'D', 'E', 'F']
})
const rows = computed(() => (props.question.questions ?? []).map(s => ({ n: s.questionNumber ?? 0, text: s.questionText ?? '', correct: s.correctAnswer ?? '' })))
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />
    <IxQuestionsRadioGrid :rows="rows" :keys="labels" :answers="answers" :disabled="disabled" :show-results="showResults" @answer="(n, v) => emit('answer', n, v)" />
  </div>
</template>
