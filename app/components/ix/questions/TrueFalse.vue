<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps & { variant: 'tfng' | 'ynng' }>()
const emit = defineEmits<QuestionEmits>()

const options = computed(() => props.variant === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'])
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question">
      <template #instruction>
        <p v-if="question.instruction && variant === 'tfng'" class="ix-instruction">
          Choose <strong>TRUE</strong> if the statement agrees with the information given in the text, choose <strong>FALSE</strong> if the statement contradicts the information, or choose <strong>NOT GIVEN</strong> if there is no information on this.
        </p>
        <p v-else-if="question.instruction" class="ix-instruction">
          Do the following statements agree with the views of the writer? Choose <strong>YES</strong> if the statement agrees with the views of the writer, choose <strong>NO</strong> if the statement contradicts the views of the writer, or choose <strong>NOT GIVEN</strong> if it is impossible to say what the writer thinks about this.
        </p>
      </template>
    </IxQuestionsHeading>

    <div>
      <div v-for="sub in question.questions ?? []" :key="sub.questionNumber" class="ix-item">
        <div class="ix-prompt">
          <IxQuestionsNum :n="sub.questionNumber ?? 0" />
          <div v-html="sub.questionText ?? ''" />
        </div>
        <IxQuestionsChoiceList
          :n="sub.questionNumber ?? 0"
          :items="options.map(o => ({ value: o, label: o, correct: o === sub.correctAnswer }))"
          :selected="answers[sub.questionNumber ?? 0]"
          :disabled="disabled"
          :show-results="showResults"
          @answer="(n, v) => emit('answer', n, v)"
        />
      </div>
    </div>
  </div>
</template>
