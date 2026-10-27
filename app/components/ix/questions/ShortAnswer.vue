<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

// A question with a gap in it ("___" or "{n}") is answered there; any other, in a box under it.
const rows = computed(() => (props.question.questions ?? []).map(sub => ({ sub, gaps: promptGaps(sub.questionText ?? '', sub.questionNumber ?? 0) })))
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />
    <div>
      <div v-for="{ sub, gaps } in rows" :key="sub.questionNumber" class="ix-item">
        <div v-if="gaps.nums.length" class="ix-prompt">
          <IxQuestionsNum :n="sub.questionNumber ?? 0" />
          <div class="ix-gapline">
            <template v-for="(part, i) in gaps.parts" :key="i">
              <IxQuestionsBlank
                v-if="i > 0"
                :n="gaps.nums[i - 1]!"
                :model-value="answers[gaps.nums[i - 1]!]"
                :correct="sub.correctAnswer"
                :disabled="disabled"
                :show-results="showResults"
                @answer="(n, v) => emit('answer', n, v)"
              /><span v-html="part" />
            </template>
          </div>
        </div>
        <template v-else>
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
        </template>
      </div>
    </div>
  </div>
</template>
