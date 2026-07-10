<script setup lang="ts">
import type { PartDto, QuestionDto } from '~/types/models'
import type { ReviewAnswer, Verdict } from '~/types/review'
import { verdictOf } from '~/types/review'

// Bottom bar mirroring ExamPartNav, but the palette scores each question
// instead of tracking whether it was answered.
const props = defineProps<{
  parts: PartDto[]
  questions: QuestionDto[]
  currentPartIndex: number
  currentQuestionId: string | null
  getAnswer: (id: string) => ReviewAnswer | undefined
}>()

const emit = defineEmits<{
  'part-change': [index: number]
  'question-click': [q: QuestionDto]
  'prev': []
  'next': []
}>()

function partQuestions(part: PartDto) {
  return props.questions
    .filter(q => q.partId === part.id)
    .sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0))
}

function correctCount(part: PartDto) {
  return partQuestions(part).filter(q => verdictOf(props.getAnswer(q.id)) === 'correct').length
}

function verdictFor(q: QuestionDto) {
  return verdictOf(props.getAnswer(q.id))
}

const PILL_CLASS: Record<Verdict, string> = {
  correct: 'border-success text-success hover:bg-success/10',
  wrong: 'border-error text-error hover:bg-error/10',
  skipped: 'border-default text-dimmed hover:bg-elevated'
}
</script>

<template>
  <div class="flex items-stretch shrink-0 bg-default border-t border-default">
    <div
      v-for="(part, idx) in parts"
      :key="part.id"
      class="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-default transition-colors"
      :class="idx === currentPartIndex
        ? 'border-t-2 border-t-primary bg-elevated/50'
        : 'hover:bg-elevated/40'"
      @click="emit('part-change', idx)"
    >
      <span
        class="text-sm whitespace-nowrap shrink-0"
        :class="idx === currentPartIndex ? 'font-bold text-highlighted' : 'font-medium text-muted'"
      >
        Part {{ idx + 1 }}
      </span>

      <!-- Active part: scored question palette -->
      <div
        v-if="idx === currentPartIndex"
        class="flex flex-wrap gap-1 min-w-0"
      >
        <button
          v-for="q in partQuestions(part)"
          :key="q.id"
          type="button"
          class="size-6 rounded-md text-[11px] font-semibold flex items-center justify-center border transition-colors shrink-0"
          :class="[
            PILL_CLASS[verdictFor(q)],
            q.id === currentQuestionId ? 'ring-2 ring-primary ring-offset-1 ring-offset-default' : ''
          ]"
          @click.stop="emit('question-click', q)"
        >
          {{ q.questionNumber ?? '·' }}
        </button>
      </div>

      <!-- Inactive part: score summary -->
      <span
        v-else
        class="text-xs text-muted font-medium whitespace-nowrap"
      >
        {{ correctCount(part) }}/{{ partQuestions(part).length }}
      </span>
    </div>

    <div class="flex items-center gap-1 shrink-0 px-2 border-l border-default">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :ui="{ base: 'rounded-full' }"
        aria-label="Previous question"
        @click="emit('prev')"
      />
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="sm"
        :ui="{ base: 'rounded-full' }"
        aria-label="Next question"
        @click="emit('next')"
      />
    </div>
  </div>
</template>
