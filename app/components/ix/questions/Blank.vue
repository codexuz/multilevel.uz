<script setup lang="ts">
/**
 * A gap to type an answer into, as the computer-delivered IELTS shows it: a box with the question's
 * number in bold in the middle until it is entered or written in.
 */
const props = defineProps<{
  n: number
  modelValue?: string
  correct?: string
  disabled?: boolean
  showResults?: boolean
  /** A whole line wide, for an answer standing on its own (short answers, labels). */
  wide?: boolean
  placeholder?: string
}>()
const emit = defineEmits<{ answer: [n: number, value: string] }>()
const { focus } = useQuestionFocus()
const review = useReviewMarks()

const state = computed(() => {
  if (review.marks) return review.gapState(props.n)
  if (!props.showResults) return ''
  const a = (props.modelValue ?? '').toLowerCase().trim()
  const c = (props.correct ?? '').toLowerCase().trim()
  if (a && a === c) return 'is-correct'
  return a || c ? 'is-wrong' : ''
})
</script>

<template>
  <input
    :id="`question-${n}`"
    class="ix-gap"
    :class="[state, { 'is-wide': wide }]"
    type="text"
    :value="modelValue ?? ''"
    :placeholder="placeholder ?? String(n)"
    :disabled="disabled"
    :aria-label="`Question ${n}`"
    autocomplete="off"
    spellcheck="false"
    @focus="focus(n)"
    @input="emit('answer', n, ($event.target as HTMLInputElement).value)"
  ><span v-if="review.marks ? review.keyFor(n).length : state === 'is-wrong' && correct" class="ix-key">{{ review.marks ? review.keyFor(n).join(' / ') : correct }}</span>
</template>
