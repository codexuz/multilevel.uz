<script setup lang="ts">
const props = defineProps<{
  n: number
  modelValue?: string
  correct?: string
  disabled?: boolean
  showResults?: boolean
  width?: string
  placeholder?: string
}>()
const emit = defineEmits<{ answer: [n: number, value: string] }>()

const state = computed(() => {
  if (!props.showResults) return 'neutral'
  const a = (props.modelValue ?? '').toLowerCase().trim()
  const c = (props.correct ?? '').toLowerCase().trim()
  if (a && a === c) return 'success'
  if (a) return 'error'
  return 'neutral'
})
</script>

<template>
  <UInput
    :id="`question-${n}`"
    :model-value="modelValue ?? ''"
    :placeholder="placeholder ?? String(n)"
    :disabled="disabled"
    :color="state === 'neutral' ? 'primary' : state"
    :highlight="state !== 'neutral'"
    size="sm"
    :class="['inline-flex align-middle mx-1', width || 'w-28']"
    :ui="{ base: 'text-center font-medium' }"
    autocomplete="off"
    spellcheck="false"
    @update:model-value="emit('answer', n, String($event))"
  />
</template>
