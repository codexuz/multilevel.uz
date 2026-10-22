<script setup lang="ts">
/**
 * A grid of round buttons: a row for each question, a column for each letter (which paragraph,
 * which place on the map), as the computer-delivered IELTS shows matching questions.
 */
const props = defineProps<{
  rows: { n: number, text: string, correct?: string }[]
  keys: string[]
  answers: Record<number, string | undefined>
  disabled?: boolean
  showResults?: boolean
  caseInsensitive?: boolean
}>()
const emit = defineEmits<{ answer: [n: number, value: string] }>()
const { focus } = useQuestionFocus()
const review = useReviewMarks()

const same = (a?: string, b?: string) => props.caseInsensitive ? (a ?? '').toUpperCase() === (b ?? '').toUpperCase() : a === b
function state(row: { n: number, correct?: string }, key: string) {
  const selected = same(props.answers[row.n], key)
  if (review.marks) {
    if (selected) return review.marks.correct(row.n) ? 'is-correct' : 'is-wrong'
    return review.marks.showKey.value && review.isKey(row.n, key) ? 'is-key' : ''
  }
  if (!props.showResults) return selected ? 'is-selected' : ''
  if (same(row.correct, key)) return 'is-correct'
  return selected ? 'is-wrong' : ''
}
</script>

<template>
  <table class="ix-table ix-grid">
    <thead>
      <tr>
        <th />
        <th v-for="k in keys" :key="k">
          {{ k }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.n">
        <td>
          <span class="ix-prompt" style="margin: 0">
            <IxQuestionsNum :n="row.n" />
            <span>{{ row.text }}</span>
          </span>
        </td>
        <td v-for="(k, i) in keys" :key="k" class="is-choice" :class="state(row, k)">
          <label>
            <input
              :id="i === 0 ? `question-${row.n}` : undefined"
              type="radio"
              :name="`q-${row.n}`"
              :checked="same(answers[row.n], k)"
              :disabled="disabled"
              :aria-label="`Question ${row.n}: ${k}`"
              @focus="focus(row.n)"
              @change="emit('answer', row.n, k)"
            >
          </label>
        </td>
      </tr>
    </tbody>
  </table>
</template>
