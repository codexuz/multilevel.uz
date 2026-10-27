<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

// A question with a gap in it ("___" or "{n}") is answered there; any other, in a box under it.
const rows = computed(() => (props.question.questions ?? []).map(sub => ({ sub, gaps: promptGaps(sub.questionText ?? '', sub.questionNumber ?? 0) })))
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />
    <div class="space-y-4">
      <div
        v-for="{ sub, gaps } in rows"
        :key="sub.questionNumber"
        class="flex items-start gap-3"
      >
        <ExamQuestionsNum :n="sub.questionNumber ?? 0" />
        <div
          v-if="gaps.nums.length"
          class="flex-1 rich-content leading-loose"
        >
          <template
            v-for="(part, i) in gaps.parts"
            :key="i"
          >
            <ExamQuestionsBlank
              v-if="i > 0"
              :n="gaps.nums[i - 1]!"
              :model-value="answers[gaps.nums[i - 1]!]"
              :correct="sub.correctAnswer"
              :disabled="disabled"
              :show-results="showResults"
              @answer="(n, v) => emit('answer', n, v)"
            />
            <span v-html="part" />
          </template>
        </div>
        <div
          v-else
          class="flex-1 space-y-2"
        >
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
