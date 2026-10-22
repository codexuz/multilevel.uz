<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />
    <div>
      <div v-for="sub in question.questions ?? []" :key="sub.questionNumber" class="ix-item">
        <div class="ix-prompt">
          <IxQuestionsNum :n="sub.questionNumber ?? 0" />
          <div v-if="sub.questionText" v-html="sub.questionText" />
        </div>
        <div class="ps-8">
          <IxQuestionsBlank
            :n="sub.questionNumber ?? 0"
            :model-value="answers[sub.questionNumber ?? 0]"
            :correct="sub.correctAnswer"
            :disabled="disabled"
            :show-results="showResults"
            wide
            @answer="(n, v) => emit('answer', n, v)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
