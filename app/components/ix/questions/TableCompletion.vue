<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()

const subs = computed(() => props.question.questions ?? [])
const correctMap = computed(() => Object.fromEntries(subs.value.map(s => [s.questionNumber ?? 0, s.correctAnswer ?? ''])))

function split(text: string) {
  const m = new RegExp(BLANK_PATTERN.source, 'i').exec(text)
  return m ? { before: text.slice(0, m.index), after: text.slice(m.index + m[0].length) } : null
}

// Every gap of a cell is a question, numbered across the table; "<br>" starts a new line in a cell.
const grid = computed(() => {
  const data = props.question.tableData
  if (!data) return null
  const nums = subs.value.map(s => s.questionNumber ?? 0).sort((a, b) => a - b)
  return { headers: data.headers, rows: gapTable(data.rows, nums) }
})
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />

    <table v-if="grid" class="ix-table">
      <thead>
        <tr>
          <th v-for="(header, hi) in grid.headers" :key="hi">
            {{ header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in grid.rows" :key="ri">
          <td v-for="(cell, ci) in row" :key="ci" :class="{ 'is-rowhead': ci === 0 && !cell.some(l => l.nums.length) }">
            <div v-for="(line, li) in cell" :key="li">
              <template v-for="(part, pi) in line.parts" :key="pi">
                <template v-if="pi > 0">
                  <IxQuestionsBlank
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
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else>
      <div v-for="sub in subs" :key="sub.questionNumber" class="ix-gapline">
        {{ split(sub.questionText ?? '')?.before ?? sub.questionText }}
        <IxQuestionsBlank
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
