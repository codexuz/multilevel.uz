<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

interface Cell { text: string, parts: { before: string, after: string } | null, n: number }

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const subs = computed(() => props.question.questions ?? [])
const correctMap = computed(() => Object.fromEntries(subs.value.map(s => [s.questionNumber ?? 0, s.correctAnswer ?? ''])))

function split(text: string) {
  const m = new RegExp(BLANK_PATTERN.source, 'i').exec(text)
  return m ? { before: text.slice(0, m.index), after: text.slice(m.index + m[0].length) } : null
}

const grid = computed(() => {
  const data = props.question.tableData
  if (!data) return null
  const nums = subs.value.map(s => s.questionNumber ?? 0).sort((a, b) => a - b)
  let counter = 0
  const rows = data.rows.map((row) => {
    const obj: Record<string, Cell> = {}
    row.forEach((cell, ci) => {
      const parts = split(cell)
      obj[`c${ci}`] = parts && counter < nums.length ? { text: cell, parts, n: nums[counter++]! } : { text: cell, parts: null, n: 0 }
    })
    return obj
  })
  const columns: TableColumn<Record<string, Cell>>[] = data.headers.map((h, i) => ({ id: `c${i}`, header: h, meta: { class: { td: 'whitespace-normal leading-loose' } } }))
  return { rows, columns, keys: data.headers.map((_, i) => `c${i}`) }
})
</script>

<template>
  <div>
    <ExamQuestionsHeading :question="question" />

    <UCard
      v-if="grid"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <UTable
        :data="grid.rows"
        :columns="grid.columns"
        :ui="{ thead: 'bg-elevated', th: 'font-bold', tbody: '[&>tr]:divide-x [&>tr]:divide-default' }"
      >
        <template
          v-for="key in grid.keys"
          :key="key"
          #[`${key}-cell`]="{ row }"
        >
          <template v-if="row.original[key]?.parts">
            {{ row.original[key]!.parts!.before }}
            <ExamQuestionsBlank
              :n="row.original[key]!.n"
              :model-value="answers[row.original[key]!.n]"
              :correct="correctMap[row.original[key]!.n]"
              :disabled="disabled"
              :show-results="showResults"
              @answer="(n, v) => emit('answer', n, v)"
            />
            {{ row.original[key]!.parts!.after }}
          </template>
          <template v-else>
            {{ row.original[key]?.text }}
          </template>
        </template>
      </UTable>
    </UCard>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="sub in subs"
        :key="sub.questionNumber"
        class="leading-loose"
      >
        <span class="font-bold text-error me-1">{{ sub.questionNumber }}.</span>
        {{ split(sub.questionText ?? '')?.before ?? sub.questionText }}
        <ExamQuestionsBlank
          :n="sub.questionNumber ?? 0"
          :model-value="answers[sub.questionNumber ?? 0]"
          :correct="sub.correctAnswer"
          :disabled="disabled"
          :show-results="showResults"
          @answer="(n, v) => emit('answer', n, v)"
        />
        {{ split(sub.questionText ?? '')?.after }}
      </div>
    </div>
  </div>
</template>
