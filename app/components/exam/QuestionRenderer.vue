<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const onAnswer = (n: number, v: string) => emit('answer', n, v)

// A summary (or sentences) written as one text with its gaps in it — "{24}", "___" — and nothing
// on its questions: shown as that text with the gaps where they stand, as the test does.
const inlineText = computed(() => {
  const q = props.question
  return new RegExp(BLANK_PATTERN.source, 'i').test(q.questionText ?? '') && !(q.questions ?? []).some(s => s.questionText?.trim())
})
</script>

<template>
  <ExamQuestionsNoteCompletion
    v-if="question.type === 'NOTE_COMPLETION' || (inlineText && ['SUMMARY_COMPLETION', 'SENTENCE_COMPLETION', 'FLOW_CHART_COMPLETION'].includes(question.type ?? ''))"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsTrueFalse
    v-else-if="question.type === 'TRUE_FALSE_NOT_GIVEN'"
    v-bind="$props"
    variant="tfng"
    @answer="onAnswer"
  />
  <ExamQuestionsTrueFalse
    v-else-if="question.type === 'YES_NO_NOT_GIVEN'"
    v-bind="$props"
    variant="ynng"
    @answer="onAnswer"
  />
  <ExamQuestionsMatchingInformation
    v-else-if="question.type === 'MATCHING_INFORMATION'"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsMatchingSelect
    v-else-if="question.type === 'MATCHING_HEADINGS'"
    v-bind="$props"
    mode="headings"
    @answer="onAnswer"
  />
  <ExamQuestionsMatchingSelect
    v-else-if="question.type === 'MATCHING_FEATURES'"
    v-bind="$props"
    mode="features"
    @answer="onAnswer"
  />
  <ExamQuestionsMatchingSelect
    v-else-if="question.type === 'MATCHING_SENTENCE_ENDINGS'"
    v-bind="$props"
    mode="endings"
    @answer="onAnswer"
  />
  <ExamQuestionsSentenceCompletion
    v-else-if="question.type === 'SENTENCE_COMPLETION' || question.type === 'FLOW_CHART_COMPLETION'"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsSentenceCompletion
    v-else-if="question.type === 'SUMMARY_COMPLETION'"
    v-bind="$props"
    show-context
    @answer="onAnswer"
  />
  <ExamQuestionsSummaryDragDrop
    v-else-if="question.type === 'SUMMARY_COMPLETION_DRAG_DROP'"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsMultipleChoice
    v-else-if="question.type === 'MULTIPLE_CHOICE'"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsMultipleAnswer
    v-else-if="question.type === 'MULTIPLE_ANSWER'"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsShortAnswer
    v-else-if="question.type === 'SHORT_ANSWER'"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsTableCompletion
    v-else-if="question.type === 'TABLE_COMPLETION'"
    v-bind="$props"
    @answer="onAnswer"
  />
  <ExamQuestionsLabelling
    v-else-if="question.type === 'DIAGRAM_LABELLING'"
    v-bind="$props"
    mode="diagram"
    @answer="onAnswer"
  />
  <ExamQuestionsLabelling
    v-else-if="question.type === 'PLAN_MAP_LABELLING'"
    v-bind="$props"
    mode="map"
    @answer="onAnswer"
  />
  <UAlert
    v-else
    color="warning"
    variant="subtle"
    icon="i-lucide-circle-help"
    :title="question.type ? `Unsupported question type: ${question.type}` : 'Unknown question type'"
  />
</template>
