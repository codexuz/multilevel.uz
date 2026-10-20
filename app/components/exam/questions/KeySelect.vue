<script setup lang="ts">
const props = defineProps<{
  n: number
  keys: string[]
  modelValue?: string
  correct?: string
  disabled?: boolean
  showResults?: boolean
  caseInsensitive?: boolean
}>()
const emit = defineEmits<{ answer: [n: number, value: string] }>()

const NONE = '__none__'
const items = computed(() => [{ label: '—', value: NONE }, ...props.keys.map(k => ({ label: k, value: k }))])

const state = computed(() => {
  if (!props.showResults || !props.modelValue) return null
  const a = props.caseInsensitive ? props.modelValue.toUpperCase() : props.modelValue
  const c = props.caseInsensitive ? (props.correct ?? '').toUpperCase() : props.correct
  return a === c ? 'success' : 'error'
})
</script>

<template>
  <USelect
    :id="`question-${n}`"
    :model-value="modelValue || undefined"
    :items="items"
    placeholder="—"
    :disabled="disabled"
    :color="state ?? 'primary'"
    :highlight="!!state"
    size="sm"
    class="w-20 shrink-0"
    @update:model-value="emit('answer', n, $event === NONE ? '' : String($event))"
  />
</template>
