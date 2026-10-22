<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

// A gap is "___" (numbered in order) or "{7}" (question 7, wherever it stands).
const BLANK_RE = /_{3,}(?:\u00A0)?|\.{3,}|\{blank\}|\{answer\}|\[blank\]|\{\d{1,2}\}/gi

function htmlToLines(html: string) {
  // A table pasted into the notes: one line per row, its cells kept apart.
  let s = html.replace(/<\/t[dh]>\s*(?=<t[dh])/gi, '  ·  ').replace(/<\/tr>/gi, '\n')
  // A list item keeps its bullet: it is marked here and drawn as one.
  s = s.replace(/<li[^>]*>/gi, '\n\u0001').replace(/<\/li>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
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
  const explicit = new Set([...html.matchAll(/\{(\d{1,2})\}/g)].map(m => Number(m[1])))
  const free = orderedNums.value.filter(n => !explicit.has(n))
  let idx = 0
  return htmlToLines(html).map((raw) => {
    const bullet = raw.startsWith('\u0001')
    const line = bullet ? raw.slice(1).trim() : raw
    const parts = line.split(BLANK_RE)
    const nums = [...line.matchAll(BLANK_RE)].map((m) => {
      const numbered = /^\{(\d{1,2})\}$/.exec(m[0])
      return numbered ? Number(numbered[1]) : (free[idx++] ?? 0)
    })
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
