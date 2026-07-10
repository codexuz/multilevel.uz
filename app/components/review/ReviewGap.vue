<script setup lang="ts">
import type { Verdict } from '~/types/review'

// One {{n}} blank inside a completion group, rendered read-only: the number
// badge, the answer the student typed, and the accepted answer when wrong.
const props = defineProps<{
  number: number
  verdict: Verdict
  response: string
  correct: string
  showAnswers: boolean
}>()

const GAP_CLASS: Record<Verdict, string> = {
  correct: 'border-success bg-success/10',
  wrong: 'border-error bg-error/10',
  skipped: 'border-default bg-elevated'
}
const NUM_CLASS: Record<Verdict, string> = {
  correct: 'bg-success text-inverted',
  wrong: 'bg-error text-inverted',
  skipped: 'bg-accented text-toned'
}

const showCorrect = computed(() => props.showAnswers && props.verdict !== 'correct' && !!props.correct)
</script>

<template>
  <span class="inline-flex items-center gap-1 mx-1 align-middle scroll-mt-24">
    <span
      class="size-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold"
      :class="NUM_CLASS[verdict]"
    >
      {{ number }}
    </span>
    <span
      class="inline-block rounded-md border-2 px-2 py-0.5 text-sm font-medium leading-normal"
      :class="GAP_CLASS[verdict]"
    >
      {{ response }}
    </span>
    <span
      v-if="showCorrect"
      class="text-xs text-success leading-normal"
    >
      (<strong class="underline">{{ correct }}</strong>)
    </span>
  </span>
</template>
