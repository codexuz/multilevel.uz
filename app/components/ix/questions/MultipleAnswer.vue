<script setup lang="ts">
import type { QuestionEmits, QuestionProps } from '~/types/question-props'

/** Choose TWO (or more): a box for each choice; the numbers of the question share the answers. */
const props = defineProps<QuestionProps>()
const emit = defineEmits<QuestionEmits>()
const { focus } = useQuestionFocus()

const range = computed(() => getQuestionRange(props.question))
const subNums = computed(() => (props.question.questions ?? []).map(s => s.questionNumber ?? 0).sort((a, b) => a - b))
const maxSelections = computed(() => subNums.value.length || 1)
const ownNum = computed(() => props.question.questionNumber ?? range.value[0])
const firstNum = computed(() => subNums.value[0] ?? ownNum.value)
const label = computed(() => range.value[0] === range.value[1] ? String(range.value[0]) : `${range.value[0]}–${range.value[1]}`)

const selectedKeys = computed(() => {
  if (subNums.value.length) return subNums.value.map(n => props.answers[n]).filter(Boolean) as string[]
  return (props.answers[ownNum.value] ?? '').split(',').filter(Boolean)
})
const atLimit = computed(() => selectedKeys.value.length >= maxSelections.value)

const options = computed(() => [...(props.question.options ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)))
const questionText = computed(() => props.question.questions?.find(s => s.questionText)?.questionText ?? props.question.questionText ?? '')

function toggle(key: string) {
  if (props.disabled) return
  let next: string[]
  if (selectedKeys.value.includes(key)) next = selectedKeys.value.filter(k => k !== key)
  else {
    if (atLimit.value) return
    next = [...selectedKeys.value, key]
  }
  if (subNums.value.length) subNums.value.forEach((n, i) => emit('answer', n, next[i] ?? ''))
  else emit('answer', ownNum.value, [...next].sort().join(','))
}

const review = useReviewMarks()

function state(o: { optionKey: string, isCorrect: boolean }) {
  const selected = selectedKeys.value.includes(o.optionKey)
  if (review.marks) {
    const right = o.isCorrect || review.isKey(firstNum.value, o.optionKey)
    if (selected) return right ? 'is-correct' : 'is-wrong'
    return right && review.marks.showKey.value ? 'is-key' : ''
  }
  if (props.showResults) return o.isCorrect ? 'is-correct' : selected ? 'is-wrong' : ''
  return selected ? 'is-selected' : ''
}
</script>

<template>
  <div>
    <IxQuestionsHeading :question="question" />
    <div class="ix-prompt">
      <IxQuestionsNum :n="label" />
      <div v-html="questionText" />
    </div>
    <div class="ix-options" role="group" :aria-label="`Questions ${label}`">
      <label
        v-for="(o, i) in options"
        :key="o.optionKey"
        class="ix-option"
        :class="[state(o), { 'is-disabled': disabled }]"
      >
        <input
          :id="i === 0 ? `question-${firstNum}` : undefined"
          type="checkbox"
          :checked="selectedKeys.includes(o.optionKey)"
          :disabled="disabled || (!selectedKeys.includes(o.optionKey) && atLimit && !showResults)"
          @focus="focus(firstNum)"
          @change="toggle(o.optionKey)"
        >
        <span>{{ o.optionText }}</span>
      </label>
    </div>
  </div>
</template>
