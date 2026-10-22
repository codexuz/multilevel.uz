<script setup lang="ts">
/**
 * The choices of one question, one under another, each with its round button as the
 * computer-delivered IELTS shows them: grey under the pointer, blue once chosen.
 */
const props = defineProps<{
  n: number
  items: { value: string, label: string, correct?: boolean }[]
  selected?: string
  disabled?: boolean
  showResults?: boolean
}>()
const emit = defineEmits<{ answer: [n: number, value: string] }>()
const { focus } = useQuestionFocus()
const review = useReviewMarks()

function state(item: { value: string, correct?: boolean }) {
  if (review.marks) {
    if (props.selected === item.value) return review.marks.correct(props.n) ? 'is-correct' : 'is-wrong'
    return review.marks.showKey.value && review.isKey(props.n, item.value) ? 'is-key' : ''
  }
  if (!props.showResults) return props.selected === item.value ? 'is-selected' : ''
  if (item.correct) return 'is-correct'
  return props.selected === item.value ? 'is-wrong' : ''
}
</script>

<template>
  <div class="ix-options" role="radiogroup" :aria-label="`Question ${n}`">
    <label
      v-for="(item, i) in items"
      :key="item.value"
      class="ix-option"
      :class="[state(item), { 'is-disabled': disabled }]"
    >
      <input
        :id="i === 0 ? `question-${n}` : undefined"
        type="radio"
        :name="`q-${n}`"
        :value="item.value"
        :checked="selected === item.value"
        :disabled="disabled"
        @focus="focus(n)"
        @change="emit('answer', n, item.value)"
      >
      <span>{{ item.label }}</span>
    </label>
  </div>
</template>
