<script setup lang="ts">
import type { IELTSQuestion } from '~/types/ielts'

const props = defineProps<{ question: IELTSQuestion, hideInstruction?: boolean }>()
const range = computed(() => getQuestionRange(props.question))
</script>

<template>
  <div class="mb-4 space-y-2">
    <p class="text-lg font-bold text-highlighted">
      {{ range[0] === range[1] ? `Question ${range[0]}` : `Questions ${range[0]}-${range[1]}` }}
    </p>
    <slot name="instruction">
      <div
        v-if="question.instruction && !hideInstruction"
        class="rich-content"
        v-html="question.instruction"
      />
    </slot>
  </div>
</template>
