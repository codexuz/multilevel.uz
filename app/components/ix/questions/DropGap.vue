<script setup lang="ts">
/** A gap to move a word or heading into, dashed and showing its number until one is placed. */
defineProps<{
  n: number
  /** What is placed in it, if anything. */
  text?: string
  state?: string
  over?: boolean
  disabled?: boolean
  block?: boolean
}>()
const emit = defineEmits<{ pick: [], drop: [e: DragEvent], take: [e: DragEvent], enter: [], leave: [], focus: [] }>()
</script>

<template>
  <div
    :id="`question-${n}`"
    class="ix-drop"
    :class="[state, { 'is-block': block, 'is-filled': !!text, 'is-over': over }]"
    tabindex="0"
    role="button"
    :aria-label="`Question ${n}: ${text || 'empty'}`"
    :draggable="!disabled && !!text"
    @focus="emit('focus')"
    @click="emit('pick')"
    @keydown.enter.prevent="emit('pick')"
    @dragstart="emit('take', $event)"
    @dragover.prevent="emit('enter')"
    @dragleave="emit('leave')"
    @drop.prevent="emit('drop', $event)"
  >
    {{ text || n }}
  </div>
</template>
