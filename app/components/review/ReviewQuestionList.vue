<script setup lang="ts">
import type { CompletionGroup } from '~/types/exam'
import type { QuestionDto } from '~/types/models'
import type { ReviewAnswer } from '~/types/review'

// The question column of a review part: completion groups first (they own their
// blanks), then every standalone question.
defineProps<{
  groups: CompletionGroup[]
  partQuestions: QuestionDto[]
  ungroupedQuestions: QuestionDto[]
  currentQuestionId: string | null
  showAnswers: boolean
  getAnswer: (id: string) => ReviewAnswer | undefined
  hideEvidence?: boolean
}>()
</script>

<template>
  <div class="space-y-6">
    <ReviewCompletionGroup
      v-for="(group, gi) in groups"
      :key="`group-${gi}`"
      :group="group"
      :questions="partQuestions"
      :get-answer="getAnswer"
      :show-answers="showAnswers"
    />

    <div
      v-for="q in ungroupedQuestions"
      :key="q.id"
      class="rounded-lg transition-colors"
      :class="q.id === currentQuestionId ? 'ring-2 ring-primary/40 -m-2 p-2' : ''"
    >
      <ReviewQuestion
        :question="q"
        :answer="getAnswer(q.id)"
        :show-answers="showAnswers"
        :hide-evidence="hideEvidence"
      />
    </div>
  </div>
</template>
