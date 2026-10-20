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
    <ExamQuestionsHeading :question="question" />
    <div class="space-y-6">
      <div
        v-for="row in rows"
        :id="`question-${row.n}`"
        :key="row.n"
      >
        <div class="flex items-start gap-3 mb-3">
          <ExamQuestionsNum :n="row.n" />
          <div
            class="rich-content leading-relaxed"
            v-html="row.text"
          />
        </div>
        <ExamQuestionsChoiceList
          class="ps-10"
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
