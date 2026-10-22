<script setup lang="ts">
import type { IELTSQuestion } from '~/types/ielts'

const props = defineProps<{ question: IELTSQuestion, hideInstruction?: boolean }>()
const range = computed(() => getQuestionRange(props.question))
</script>

<template>
  <div>
    <h3 class="ix-qhead">
      {{ range[0] === range[1] ? `Question ${range[0]}` : `Questions ${range[0]}–${range[1]}` }}
    </h3>
    <slot name="instruction">
      <div v-if="question.instruction && !hideInstruction" class="ix-instruction" v-html="question.instruction" />
    </slot>
  </div>
</template>
