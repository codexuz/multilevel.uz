<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps & { showContext?: boolean }>()
const emit = defineEmits<QuestionEmits>()

// A sentence's gap is its question's ("___" or "{n}"); a sentence without one has its gap at the end.
const lines = computed(() => (props.question.questions ?? []).map((sub) => {
  const n = sub.questionNumber ?? 0
  const gaps = promptGaps(sub.questionText ?? '', n)
  return { sub, ...(gaps.nums.length ? gaps : { parts: [`${sub.questionText ?? ''} `, ''], nums: [n] }) }
}))
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />
    <h4 v-if="showContext && question.context" class="ix-qtitle">
      {{ question.context }}
    </h4>
    <div>
      <div v-for="line in lines" :key="line.sub.questionNumber" class="ix-gapline ix-item">
        <template v-for="(part, pi) in line.parts" :key="pi">
          <IxQuestionsBlank
            v-if="pi > 0"
            :n="line.nums[pi - 1]!"
            :model-value="answers[line.nums[pi - 1]!]"
            :correct="line.sub.correctAnswer"
            :disabled="disabled"
            :show-results="showResults"
            @answer="(n, v) => emit('answer', n, v)"
          />
          <span v-html="part" />
        </template>
      </div>
    </div>
  </div>
</template>
