<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

defineProps<QuestionProps & { showContext?: boolean }>()
const emit = defineEmits<QuestionEmits>()

function split(text: string) {
  const re = new RegExp(BLANK_PATTERN.source, 'i')
  const m = re.exec(text)
  if (!m) return { before: `${text} `, after: '' }
  return { before: text.slice(0, m.index), after: text.slice(m.index + m[0].length) }
}
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />
    <p
      v-if="showContext && question.context"
      class="mb-3 italic text-muted"
    >
      {{ question.context }}
    </p>
    <div class="space-y-3">
      <div
        v-for="sub in question.questions ?? []"
        :key="sub.questionNumber"
        class="leading-loose"
      >
        <span>{{ split(sub.questionText ?? '').before }}</span>
        <ExamQuestionsBlank
          :n="sub.questionNumber ?? 0"
          :model-value="answers[sub.questionNumber ?? 0]"
          :correct="sub.correctAnswer"
          :disabled="disabled"
          :show-results="showResults"
          @answer="(n, v) => emit('answer', n, v)"
        />
        <span>{{ split(sub.questionText ?? '').after }}</span>
      </div>
    </div>
  </div>
</template>
