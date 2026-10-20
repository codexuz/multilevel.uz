<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />
    <div class="space-y-4">
      <div
        v-for="sub in question.questions ?? []"
        :key="sub.questionNumber"
        class="flex items-start gap-3"
      >
        <ExamQuestionsNum :n="sub.questionNumber ?? 0" />
        <div class="flex-1 space-y-2">
          <div
            v-if="sub.questionText"
            class="rich-content"
            v-html="sub.questionText"
          />
          <ExamQuestionsBlank
            :n="sub.questionNumber ?? 0"
            :model-value="answers[sub.questionNumber ?? 0]"
            :correct="sub.correctAnswer"
            :disabled="disabled"
            :show-results="showResults"
            placeholder="Type your answer"
            width="w-full max-w-xs !mx-0"
            @answer="(n, v) => emit('answer', n, v)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
