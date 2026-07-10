<script setup lang="ts">
import type { QuestionDto } from '~/types/models'
import type { ReviewAnswer } from '~/types/review'
import { verdictOf, formatAnswer, formatCorrectAnswer, labelFor } from '~/types/review'

const props = defineProps<{
  question: QuestionDto
  answer: ReviewAnswer | undefined
  showAnswers: boolean
  // Reading hides the evidence quote here because it is highlighted in the passage.
  hideEvidence?: boolean
}>()

const q = computed(() => props.question)
const verdict = computed(() => verdictOf(props.answer))
const isCorrect = computed(() => verdict.value === 'correct')

const isChoice = computed(() => q.value.type === 'single_choice' || q.value.type === 'multiple_choice')
const isInput = computed(() => q.value.type === 'text_input' || q.value.type === 'dropdown_match')

const selected = computed(() => {
  const r = props.answer?.response
  if (r == null) return []
  return Array.isArray(r) ? r.map(String) : [String(r)]
})
const correctValues = computed(() => {
  const c = q.value.correctAnswer
  if (c == null) return []
  return Array.isArray(c) ? c.map(String) : [String(c)]
})

const responseText = computed(() => formatAnswer(props.answer?.response) || 'Not answered')
const correctText = computed(() => formatCorrectAnswer(q.value))

// Dropdown answers are option values; show the label the student saw.
const responseLabel = computed(() => {
  const r = props.answer?.response
  if (q.value.type !== 'dropdown_match' || typeof r !== 'string' || !r) return responseText.value
  return labelFor(q.value, r)
})

function optionState(value: string) {
  const picked = selected.value.includes(value)
  const right = correctValues.value.includes(value)
  if (picked && right) return 'picked-correct'
  if (picked && !right) return 'picked-wrong'
  if (right && props.showAnswers) return 'missed-correct'
  return 'neutral'
}

const OPTION_CLASS: Record<string, string> = {
  'picked-correct': 'border-success bg-success/10',
  'picked-wrong': 'border-error bg-error/10',
  'missed-correct': 'border-success/50 bg-success/5',
  'neutral': 'border-default'
}

const BADGE_CLASS: Record<string, string> = {
  correct: 'bg-success text-inverted',
  wrong: 'bg-error text-inverted',
  skipped: 'bg-accented text-toned'
}

const INPUT_CLASS: Record<string, string> = {
  correct: 'border-success bg-success/10',
  wrong: 'border-error bg-error/10',
  skipped: 'border-default bg-elevated'
}
</script>

<template>
  <div
    :id="`q-${q.id}`"
    class="flex gap-3 scroll-mt-4"
  >
    <span
      class="size-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
      :class="BADGE_CLASS[verdict]"
    >
      {{ q.questionNumber ?? '·' }}
    </span>

    <div class="flex-1 min-w-0 space-y-2">
      <!-- eslint-disable vue/no-v-html -->
      <p
        v-if="q.prompt"
        class="text-sm font-medium text-highlighted"
        v-html="q.prompt"
      />
      <!-- eslint-enable vue/no-v-html -->

      <!-- Single / multiple choice: every option, marked up -->
      <div
        v-if="isChoice"
        class="space-y-1.5"
      >
        <div
          v-for="opt in q.options"
          :key="opt.value"
          class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          :class="OPTION_CLASS[optionState(opt.value)]"
        >
          <span class="font-semibold text-muted shrink-0 w-5">{{ opt.value }}</span>
          <span class="flex-1 min-w-0">{{ opt.label }}</span>
          <UIcon
            v-if="optionState(opt.value) === 'picked-correct'"
            name="i-lucide-check-circle"
            class="size-4 text-success shrink-0"
          />
          <UIcon
            v-else-if="optionState(opt.value) === 'picked-wrong'"
            name="i-lucide-x-circle"
            class="size-4 text-error shrink-0"
          />
          <UIcon
            v-else-if="optionState(opt.value) === 'missed-correct'"
            name="i-lucide-check"
            class="size-4 text-success shrink-0"
          />
        </div>
      </div>

      <!-- Gap fill / dropdown: the student's answer beside the accepted one -->
      <div
        v-else-if="isInput"
        class="flex flex-wrap items-center gap-2 text-sm"
      >
        <span
          class="inline-block rounded-md border-2 px-3 py-1 font-medium"
          :class="INPUT_CLASS[verdict]"
        >
          {{ responseLabel }}
        </span>
        <span
          v-if="showAnswers && !isCorrect"
          class="text-success"
        >
          Correct: <strong class="underline">{{ correctText }}</strong>
        </span>
        <UIcon
          v-if="isCorrect"
          name="i-lucide-check-circle"
          class="size-4 text-success"
        />
      </div>

      <!-- Supporting quote from the passage / transcript -->
      <div
        v-if="showAnswers && !hideEvidence && q.meta.fromText"
        class="rounded-md border-l-2 border-info bg-info/5 px-3 py-2"
      >
        <p class="text-xs font-semibold text-info mb-0.5">
          From the text
        </p>
        <p class="text-xs italic text-muted whitespace-pre-line">
          {{ q.meta.fromText }}
        </p>
      </div>

      <!-- Why the answer is what it is -->
      <div
        v-if="showAnswers && q.meta.explanation"
        class="rounded-md bg-warning/10 px-3 py-2"
      >
        <p class="text-xs font-semibold text-warning mb-0.5">
          Explanation
        </p>
        <p class="text-xs text-default whitespace-pre-line">
          {{ q.meta.explanation }}
        </p>
      </div>
    </div>
  </div>
</template>
