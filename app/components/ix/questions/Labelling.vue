<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps & { mode: 'diagram' | 'map' }>()
const emit = defineEmits<QuestionEmits>()

const html = computed(() => props.question.questionText ?? '')
const imageSrc = computed(() => html.value.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null)

const gapSentences = computed(() => {
  const out: string[] = []
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html.value)) !== null) {
    const t = m[1]!.replace(/<[^>]*>/g, '').trim()
    if (t) out.push(t)
  }
  return out
})

const remainingText = computed(() => html.value.replace(/<img[^>]*>/gi, '').replace(/<p>\s*<\/p>/gi, '').trim())
const options = computed(() => [...(props.question.options ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)))

const rows = computed(() => (props.question.questions ?? []).map(s => ({ n: s.questionNumber ?? 0, text: s.questionText ?? '', correct: s.correctAnswer ?? '' })))
// Each label's sentence split at its gap ("___" or "{n}"); one without a gap has its box after it.
const labels = computed(() => (props.question.questions ?? []).map((sub, idx) => ({ sub, text: gapSentences.value[idx] ?? sub.questionText ?? '', gaps: promptGaps(gapSentences.value[idx] ?? sub.questionText ?? '', sub.questionNumber ?? 0) })))
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />

    <img v-if="imageSrc" :src="imageSrc" :alt="mode === 'map' ? 'Plan / map' : 'Diagram'" class="ix-image" style="margin-bottom: 16px" draggable="false">

    <template v-if="mode === 'map'">
      <div v-if="remainingText" class="ix-instruction" v-html="remainingText" />
      <IxQuestionsRadioGrid
        :rows="rows"
        :keys="options.map(o => o.optionKey)"
        :answers="answers"
        :disabled="disabled"
        :show-results="showResults"
        case-insensitive
        @answer="(n, v) => emit('answer', n, v)"
      />
    </template>

    <div v-else>
      <div v-for="{ sub, text, gaps } in labels" :key="sub.questionNumber" class="ix-item ix-gapline">
        <template v-if="gaps.nums.length">
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
        </template>
        <div v-else class="ix-prompt">
          <IxQuestionsNum :n="sub.questionNumber ?? 0" />
          <span>
            <span v-if="text" v-html="text" />
            <IxQuestionsBlank
              :n="sub.questionNumber ?? 0"
              :model-value="answers[sub.questionNumber ?? 0]"
              :correct="sub.correctAnswer"
              :disabled="disabled"
              :show-results="showResults"
              @answer="(n, v) => emit('answer', n, v)"
            />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
