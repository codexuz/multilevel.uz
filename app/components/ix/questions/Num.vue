<script setup lang="ts">
/** A question's number, bold, boxed in blue while it is the question in hand; ticked or crossed on a marked paper. */
const props = defineProps<{ n: number | string }>()
const { isCurrent } = useQuestionFocus()
const { marks } = useReviewMarks()
const range = computed(() => {
  const [from, to = from] = String(props.n).split('–').map(Number)
  return [from!, to!] as const
})
// "18–19": boxed while either of its numbers is in hand.
const current = computed(() => {
  for (let i = range.value[0]; i <= range.value[1]; i++) if (isCurrent(i)) return true
  return false
})
const marked = computed(() => {
  if (!marks || !Number.isFinite(range.value[0])) return null
  const nums = Array.from({ length: range.value[1] - range.value[0] + 1 }, (_, i) => range.value[0] + i)
  const right = nums.filter(n => marks.correct(n)).length
  return right === nums.length ? 'right' : right ? 'part' : 'wrong'
})
</script>

<template>
  <span class="ix-num" :class="{ 'is-current': current }">{{ n }}</span><span
    v-if="marked"
    class="ix-mark"
    :class="`is-${marked}`"
    role="img"
    :aria-label="marked === 'right' ? 'Correct' : marked === 'part' ? 'Partly correct' : 'Incorrect'"
  ><UIcon :name="marked === 'wrong' ? 'i-lucide-x' : 'i-lucide-check'" /></span>
</template>
