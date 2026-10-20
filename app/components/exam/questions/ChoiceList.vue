<script setup lang="ts">
const props = defineProps<{
  n: number
  items: { value: string, label: string, correct?: boolean }[]
  selected?: string
  disabled?: boolean
  showResults?: boolean
}>()
const emit = defineEmits<{ answer: [n: number, value: string] }>()

function color(item: { value: string, correct?: boolean }) {
  if (!props.showResults) return props.selected === item.value ? 'primary' : 'neutral'
  if (item.correct) return 'success'
  if (props.selected === item.value) return 'error'
  return 'neutral'
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <UButton
      v-for="item in items"
      :key="item.value"
      :color="color(item)"
      :variant="selected === item.value || (showResults && item.correct) ? 'soft' : 'ghost'"
      :disabled="disabled"
      :icon="selected === item.value ? 'i-lucide-circle-dot' : 'i-lucide-circle'"
      class="justify-start text-left whitespace-normal font-normal disabled:opacity-100"
      :class="selected === item.value ? 'font-medium' : ''"
      @click="emit('answer', n, item.value)"
    >
      {{ item.label }}
    </UButton>
  </div>
</template>
