<script setup lang="ts">
import type { IELTSQuestion } from '~/types/ielts'
import type { AnswerMap } from '~/types/exam'

defineProps<{
  questions: IELTSQuestion[]
  answers: AnswerMap
  disabled?: boolean
  showResults?: boolean
}>()
const emit = defineEmits<{ answer: [n: number, value: string] }>()
</script>

<template>
  <div class="h-full overflow-y-auto px-4 md:px-6 py-4 bg-default">
    <template
      v-for="(q, idx) in questions"
      :key="q.id ?? idx"
    >
      <ExamQuestionRenderer
        :question="q"
        :answers="answers"
        :disabled="disabled"
        :show-results="showResults"
        @answer="(n, v) => emit('answer', n, v)"
      />
      <USeparator
        v-if="idx < questions.length - 1"
        class="my-6"
      />
    </template>
  </div>
</template>
