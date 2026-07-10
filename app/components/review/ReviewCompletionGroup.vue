<script setup lang="ts">
import type { CompletionGroup } from '~/types/exam'
import type { QuestionDto } from '~/types/models'
import type { ReviewAnswer } from '~/types/review'
import { verdictOf, formatAnswer, formatCorrectAnswer } from '~/types/review'

// Read-only mirror of ExamCompletionGroup: the same shared paragraph/table
// shell, with each {{n}} blank replaced by the student's answer and its verdict.
const props = defineProps<{
  group: CompletionGroup
  questions: QuestionDto[]
  getAnswer: (id: string) => ReviewAnswer | undefined
  showAnswers: boolean
}>()

const TOKEN = /\{\{\s*(\d+)\s*\}\}/

type Segment
  = | { type: 'text', text: string }
    | { type: 'gap', n: number }

function toSegments(text: string): Segment[] {
  return text
    .split(/(\{\{\s*\d+\s*\}\})/)
    .map((chunk): Segment | null => {
      const m = TOKEN.exec(chunk)
      if (m) return { type: 'gap', n: Number(m[1]) }
      return chunk ? { type: 'text', text: chunk } : null
    })
    .filter((s): s is Segment => s !== null)
}

const byNumber = computed(() => {
  const map = new Map<number, QuestionDto>()
  for (const q of props.questions) {
    if (q.questionNumber != null) map.set(q.questionNumber, q)
  }
  return map
})

function questionAt(n: number) {
  return byNumber.value.get(n)
}
function verdictAt(n: number) {
  const q = questionAt(n)
  return q ? verdictOf(props.getAnswer(q.id)) : 'skipped'
}
function responseAt(n: number) {
  const q = questionAt(n)
  const text = q ? formatAnswer(props.getAnswer(q.id)?.response) : ''
  return text || '—'
}
function correctAt(n: number) {
  const q = questionAt(n)
  return q ? formatCorrectAnswer(q) : ''
}

const paragraphSegments = computed(() => toSegments(props.group.template ?? ''))

// Gaps live inside the shell, so their explanations are collected underneath it.
const gapNumbers = computed(() => {
  const source = props.group.template ?? (props.group.rows?.flat().join(' ') ?? '')
  return [...source.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => Number(m[1]))
})
const explained = computed(() =>
  gapNumbers.value
    .map(n => questionAt(n))
    .filter((q): q is QuestionDto => !!q && (!!q.meta.explanation || !!q.meta.fromText))
)
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="group.heading"
      class="text-sm font-medium text-highlighted"
    >
      {{ group.heading }}
    </p>

    <!-- Paragraph / note / sentence / flow-chart completion -->
    <p
      v-if="group.template"
      class="text-sm leading-9"
    >
      <template
        v-for="(seg, i) in paragraphSegments"
        :key="i"
      >
        <!-- eslint-disable vue/no-v-html -->
        <span
          v-if="seg.type === 'text'"
          v-html="seg.text"
        />
        <!-- eslint-enable vue/no-v-html -->
        <ReviewGap
          v-else
          :id="questionAt(seg.n) ? `q-${questionAt(seg.n)!.id}` : undefined"
          :number="seg.n"
          :verdict="verdictAt(seg.n)"
          :response="responseAt(seg.n)"
          :correct="correctAt(seg.n)"
          :show-answers="showAnswers"
        />
      </template>
    </p>

    <!-- Table completion -->
    <div
      v-else-if="group.rows"
      class="overflow-x-auto"
    >
      <table class="w-full border-collapse text-sm">
        <thead v-if="group.columns">
          <tr>
            <th
              v-for="(col, ci) in group.columns"
              :key="ci"
              class="border border-default bg-elevated px-3 py-2 text-left font-semibold"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ri) in group.rows"
            :key="ri"
          >
            <td
              v-for="(cell, ci) in row"
              :key="ci"
              class="border border-default px-3 py-2 align-middle"
            >
              <template
                v-for="(seg, i) in toSegments(cell)"
                :key="i"
              >
                <!-- eslint-disable vue/no-v-html -->
                <span
                  v-if="seg.type === 'text'"
                  v-html="seg.text"
                />
                <!-- eslint-enable vue/no-v-html -->
                <ReviewGap
                  v-else
                  :id="questionAt(seg.n) ? `q-${questionAt(seg.n)!.id}` : undefined"
                  :number="seg.n"
                  :verdict="verdictAt(seg.n)"
                  :response="responseAt(seg.n)"
                  :correct="correctAt(seg.n)"
                  :show-answers="showAnswers"
                />
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Explanations for the blanks above -->
    <div
      v-if="showAnswers && explained.length"
      class="space-y-2 rounded-lg border border-default bg-elevated/30 p-3"
    >
      <div
        v-for="q in explained"
        :key="q.id"
        class="flex gap-2 text-xs"
      >
        <span class="font-semibold text-muted shrink-0">{{ q.questionNumber }}.</span>
        <div class="space-y-1 min-w-0">
          <p
            v-if="q.meta.fromText"
            class="italic text-muted whitespace-pre-line"
          >
            “{{ q.meta.fromText }}”
          </p>
          <p
            v-if="q.meta.explanation"
            class="text-default whitespace-pre-line"
          >
            {{ q.meta.explanation }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
