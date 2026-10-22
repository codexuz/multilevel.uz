<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const range = computed(() => getQuestionRange(props.question))
const options = computed(() => [...(props.question.options ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)))

const rows = computed(() => {
  const subs = props.question.questions ?? []
  if (subs.length) return subs.map(s => ({ n: s.questionNumber ?? 0, text: s.questionText ?? '', correct: s.correctAnswer ?? '' }))
  return [{ n: props.question.questionNumber ?? range.value[0], text: props.question.questionText ?? '', correct: '' }]
})

function items(correct: string) {
  return options.value.map(o => ({ value: o.optionKey, label: o.optionText, correct: o.isCorrect || (!!correct && o.optionKey === correct) }))
}
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />
    <div>
      <div v-for="row in rows" :key="row.n" class="ix-item">
        <div class="ix-prompt">
          <IxQuestionsNum :n="row.n" />
          <div v-html="row.text" />
        </div>
        <IxQuestionsChoiceList
          :n="row.n"
          :items="items(row.correct)"
          :selected="answers[row.n]"
          :disabled="disabled"
          :show-results="showResults"
          @answer="(n, v) => emit('answer', n, v)"
        />
      </div>
    </div>
  </div>
</template>
