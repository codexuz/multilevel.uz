<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { QuestionEmits, QuestionProps } from '~/types/question-props'
import type { GapLine } from '~/utils/exam'

type Cell = GapLine[]

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const subs = computed(() => props.question.questions ?? [])
const correctMap = computed(() => Object.fromEntries(subs.value.map(s => [s.questionNumber ?? 0, s.correctAnswer ?? ''])))

// Every gap of a cell is a question, numbered across the table; "<br>" starts a new line in a cell.
const grid = computed(() => {
  const data = props.question.tableData
  if (!data) return null
  const nums = subs.value.map(s => s.questionNumber ?? 0).sort((a, b) => a - b)
  const rows = gapTable(data.rows, nums).map(row => Object.fromEntries(row.map((cell, ci) => [`c${ci}`, cell])) as Record<string, Cell>)
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
          <div
            v-for="(line, li) in row.original[key] ?? []"
            :key="li"
          >
            <template
              v-for="(part, pi) in line.parts"
              :key="pi"
            >
              <template v-if="pi > 0">
                <ExamQuestionsBlank
                  v-if="line.nums[pi - 1]"
                  :n="line.nums[pi - 1]!"
                  :model-value="answers[line.nums[pi - 1]!]"
                  :correct="correctMap[line.nums[pi - 1]!]"
                  :disabled="disabled"
                  :show-results="showResults"
                  @answer="(n, v) => emit('answer', n, v)"
                />
                <span v-else>______</span>
              </template>
              <span v-html="part" />
            </template>
          </div>
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
        {{ splitAtGap(sub.questionText ?? '')?.before ?? sub.questionText }}
        <ExamQuestionsBlank
          :n="sub.questionNumber ?? 0"
          :model-value="answers[sub.questionNumber ?? 0]"
          :correct="sub.correctAnswer"
          :disabled="disabled"
          :show-results="showResults"
          @answer="(n, v) => emit('answer', n, v)"
        />
        {{ splitAtGap(sub.questionText ?? '')?.after }}
      </div>
    </div>
  </div>
</template>
