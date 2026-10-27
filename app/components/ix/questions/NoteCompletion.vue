<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

function htmlToLines(html: string) {
  // A table pasted into the notes: one line per row, its cells kept apart.
  let s = html.replace(/<\/t[dh]>\s*(?=<t[dh])/gi, '  ·  ').replace(/<\/tr>/gi, '\n')
  // A list item keeps its bullet: it is marked here and drawn as one.
  s = s.replace(/<li[^>]*>/gi, '\n\u0001').replace(/<\/li>/gi, '\n').replace(/<\/(?:p|div)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
  // A heading stands on a line of its own.
  s = s.replace(/<h[1-6]\b[^>]*>/gi, '\n$&').replace(/<\/h[1-6]>/gi, '$&\n')
  s = s.replace(/<(?!\/?(?:strong|b|em|i|h[1-6])\b)[^>]+>/gi, '')
  s = s.replace(/&nbsp;/gi, ' ')
  return s.split('\n').map(l => l.trim()).filter(Boolean)
}

const subs = computed(() => props.question.questions ?? [])
const orderedNums = computed(() => [...subs.value].sort((a, b) => (a.order ?? a.questionNumber ?? 0) - (b.order ?? b.questionNumber ?? 0)).map(s => s.questionNumber ?? 0))
const correctMap = computed(() => Object.fromEntries(subs.value.map(s => [s.questionNumber ?? 0, s.correctAnswer ?? ''])))

const lines = computed(() => {
  const html = props.question.questionText ?? ''
  // Numbered gaps keep their number; plain gaps take the remaining numbers in order.
  const numberOf = gapNumberer(html, orderedNums.value)
  return htmlToLines(html).map((raw) => {
    const bullet = raw.startsWith('\u0001')
    const line = bullet ? raw.slice(1).trim() : raw
    const { parts, nums } = splitGaps(line, numberOf)
    return { parts, nums, bullet }
  })
})
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />
    <div class="ix-notes-text">
      <div v-for="(line, li) in lines" :key="li" class="ix-gapline" :class="{ 'is-bullet': line.bullet }">
        <template v-for="(part, pi) in line.parts" :key="pi">
          <IxQuestionsBlank
            v-if="pi > 0"
            :n="line.nums[pi - 1]!"
            :model-value="answers[line.nums[pi - 1]!]"
            :correct="correctMap[line.nums[pi - 1]!]"
            :disabled="disabled"
            :show-results="showResults"
            @answer="(n, v) => emit('answer', n, v)"
          />
          <span v-html="part" />
        </template>
      </div>
    </div>
  </div>
</template>
