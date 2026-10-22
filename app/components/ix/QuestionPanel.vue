<script setup lang="ts">
import type { IELTSQuestion } from '~/types/ielts'
import type { AnswerMap } from '~/types/exam'

const props = defineProps<{
  questions: IELTSQuestion[]
  answers: AnswerMap
  disabled?: boolean
  showResults?: boolean
  /** The question in hand, boxed in blue. */
  currentQuestion?: number | null
}>()
const emit = defineEmits<{ answer: [n: number, value: string], focus: [n: number] }>()

provide(QUESTION_FOCUS, { current: computed(() => props.currentQuestion), focus: n => emit('focus', n) })
</script>

<template>
  <div class="ix-questions">
    <IxQuestionRenderer
      v-for="(q, idx) in questions"
      :key="q.id ?? idx"
      :question="q"
      :answers="answers"
      :disabled="disabled"
      :show-results="showResults"
      @answer="(n, v) => emit('answer', n, v)"
    />
  </div>
</template>
