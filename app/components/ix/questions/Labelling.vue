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
const sentence = (idx: number, sub: { questionText?: string }) => gapSentences.value[idx] ?? sub.questionText ?? ''
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
      <div v-for="(sub, idx) in question.questions ?? []" :key="sub.questionNumber" class="ix-item ix-gapline">
        <template v-if="sentence(idx, sub).split(/_{2,}/).length > 1">
          <template v-for="(part, i) in sentence(idx, sub).split(/_{2,}/)" :key="i">
            {{ part }}<IxQuestionsBlank
              v-if="i < sentence(idx, sub).split(/_{2,}/).length - 1"
              :n="sub.questionNumber ?? 0"
              :model-value="answers[sub.questionNumber ?? 0]"
              :correct="sub.correctAnswer"
              :disabled="disabled"
              :show-results="showResults"
              @answer="(n, v) => emit('answer', n, v)"
            />
          </template>
        </template>
        <div v-else class="ix-prompt">
          <IxQuestionsNum :n="sub.questionNumber ?? 0" />
          <span>
            <span v-if="sentence(idx, sub)" v-html="sentence(idx, sub)" />
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
