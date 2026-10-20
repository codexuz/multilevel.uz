<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps & { mode: 'headings' | 'features' | 'endings' }>()
const emit = defineEmits<QuestionEmits>()

function romanToInt(roman: string) {
  const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 }
  const s = roman.toLowerCase()
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]!] ?? 0
    const next = map[s[i + 1]!] ?? 0
    total += curr < next ? -curr : curr
  }
  return total
}

const entries = computed<[string, string][]>(() => {
  const q = props.question
  if (props.mode === 'headings' && q.headingOptions) {
    return Object.entries(q.headingOptions).sort(([a], [b]) => romanToInt(a) - romanToInt(b))
  }
  return [...(q.options ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map(o => [o.optionKey, o.optionText])
})

const listTitle = computed(() => ({ headings: 'List of headings', features: '', endings: 'Sentence endings' })[props.mode])
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />

    <UCard
      v-if="entries.length"
      variant="soft"
      class="mb-4"
      :ui="{ body: 'p-3 sm:p-3 space-y-1' }"
    >
      <p
        v-if="listTitle"
        class="text-xs font-bold uppercase text-muted mb-2"
      >
        {{ listTitle }}
      </p>
      <p
        v-for="[key, text] in entries"
        :key="key"
      >
        <strong>{{ key }}</strong>&nbsp;&nbsp;{{ text }}
      </p>
    </UCard>

    <div class="space-y-3">
      <div
        v-for="sub in question.questions ?? []"
        :key="sub.questionNumber"
        class="flex items-start gap-3"
      >
        <ExamQuestionsNum :n="sub.questionNumber ?? 0" />
        <p class="flex-1 mt-0.5 leading-relaxed">
          {{ sub.questionText }}
        </p>
        <ExamQuestionsKeySelect
          :n="sub.questionNumber ?? 0"
          :keys="entries.map(e => e[0])"
          :model-value="answers[sub.questionNumber ?? 0]"
          :correct="sub.correctAnswer"
          :disabled="disabled"
          :show-results="showResults"
          @answer="(n, v) => emit('answer', n, v)"
        />
      </div>
    </div>
  </div>
</template>
