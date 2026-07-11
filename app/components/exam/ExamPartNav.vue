<script setup lang="ts">
import type { StudentQuestionDto, PartDto } from '~/types/models'

// Bottom navigation bar shared by the Reading and Listening runners.
// Shows one tab per part; the active tab expands into a palette of
// question-number pills (answered / current state) that jump to a question,
// while inactive tabs collapse to an "answered of total" count.
const props = defineProps<{
  parts: PartDto[]
  questions: StudentQuestionDto[]
  currentPartIndex: number
  currentQuestionId: string | null
  isAnswered: (q: StudentQuestionDto) => boolean
}>()

const emit = defineEmits<{
  'part-change': [index: number]
  'question-click': [q: StudentQuestionDto]
  'prev': []
  'next': []
}>()

function partQuestions(part: PartDto) {
  return props.questions
    .filter(q => q.partId === part.id)
    .sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0))
}

function answeredCount(part: PartDto) {
  return partQuestions(part).filter(props.isAnswered).length
}
</script>

<template>
  <div class="flex items-stretch shrink-0 bg-default border-t border-default">
    <!-- Part tabs: equal columns on desktop; a single scrollable row on mobile
         so the bar never grows past one line. -->
    <div class="flex-1 min-w-0 flex items-stretch overflow-x-auto lg:overflow-visible">
      <div
        v-for="(part, idx) in parts"
        :key="part.id"
        class="shrink-0 lg:flex-1 lg:min-w-0 flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-default transition-colors"
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

        <!-- Active part: question-number palette (one row on mobile, wraps on desktop) -->
        <div
          v-if="idx === currentPartIndex"
          class="flex flex-nowrap lg:flex-wrap gap-1 min-w-0"
        >
          <button
            v-for="q in partQuestions(part)"
            :key="q.id"
            type="button"
            class="relative size-6 rounded-md text-[11px] font-semibold flex items-center justify-center border transition-colors shrink-0"
            :class="[
              isAnswered(q)
                ? 'bg-primary text-inverted border-primary hover:bg-primary/90'
                : 'bg-default text-muted border-default hover:border-primary',
              q.id === currentQuestionId ? 'ring-2 ring-primary ring-offset-1 ring-offset-default' : ''
            ]"
            @click.stop="emit('question-click', q)"
          >
            {{ q.questionNumber ?? '·' }}
          </button>
        </div>

        <!-- Inactive part: answered count -->
        <span
          v-else
          class="text-xs text-muted font-medium whitespace-nowrap"
        >
          {{ answeredCount(part) }}/{{ partQuestions(part).length }}
        </span>
      </div>
    </div>

    <!-- Prev / next question -->
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
