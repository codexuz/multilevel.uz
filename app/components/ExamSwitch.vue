<script setup lang="ts">
/**
 * IELTS or Multilevel: the two exams the app prepares for, as a large two-way switch. The choice is
 * kept (useExam) so every list opens on it next time.
 */
const props = withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' })
const emit = defineEmits<{ change: [exam: Exam] }>()
const { exam, setExam } = useExam()
const { t } = useI18n()

const items = computed(() => [
  { value: 'IELTS' as const, label: 'IELTS', hint: t('exam.ieltsHint'), icon: 'i-lucide-globe-2' },
  { value: 'MULTILEVEL' as const, label: 'Multilevel', hint: t('exam.multilevelHint'), icon: 'i-lucide-flag' }
])
async function pick(value: Exam) {
  await setExam(value)
  emit('change', value)
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="t('exam.choose')"
    class="grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1 ring ring-default"
    :class="props.size === 'lg' ? 'w-full sm:w-[28rem]' : 'w-full sm:w-96'"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="radio"
      :aria-checked="exam === item.value"
      class="flex items-center gap-2.5 rounded-lg px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary"
      :class="[
        props.size === 'lg' ? 'py-3' : 'py-2',
        exam === item.value ? 'bg-default shadow-sm ring ring-default text-highlighted' : 'text-muted hover:text-default'
      ]"
      @click="pick(item.value)"
    >
      <UIcon
        :name="item.icon"
        class="size-5 shrink-0"
        :class="exam === item.value ? 'text-primary' : ''"
      />
      <span class="min-w-0">
        <span class="block font-semibold leading-tight">{{ item.label }}</span>
        <span class="block text-xs truncate opacity-80">{{ item.hint }}</span>
      </span>
    </button>
  </div>
</template>
