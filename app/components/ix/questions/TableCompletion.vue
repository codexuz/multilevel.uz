<script setup lang="ts">
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
  const columns = data.headers.map((h, i) => ({ id: `c${i}`, header: h }))
  return { rows, columns, keys: data.headers.map((_, i) => `c${i}`) }
})
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />

    <table v-if="grid" class="ix-table">
      <thead>
        <tr>
          <th v-for="col in grid.columns" :key="String(col.id)">
            {{ col.header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in grid.rows" :key="ri">
          <td v-for="(key, ci) in grid.keys" :key="key" :class="{ 'is-rowhead': ci === 0 && !row[key]?.parts }">
            <template v-if="row[key]?.parts">
              {{ row[key]!.parts!.before }}<IxQuestionsBlank
                :n="row[key]!.n"
                :model-value="answers[row[key]!.n]"
                :correct="correctMap[row[key]!.n]"
                :disabled="disabled"
                :show-results="showResults"
                @answer="(n, v) => emit('answer', n, v)"
              />{{ row[key]!.parts!.after }}
            </template>
            <template v-else>
              {{ row[key]?.text }}
            </template>
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
