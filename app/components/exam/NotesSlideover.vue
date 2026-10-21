<script setup lang="ts">
const { t } = useI18n()
const props = defineProps<{ modelValue: string, title?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = defineModel<boolean>('open', { default: false })

const draft = ref('')
watch(open, (v) => {
  if (v) draft.value = props.modelValue
})

function save() {
  emit('update:modelValue', draft.value)
  open.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="title || t('exam.notes')"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UTextarea
        v-model="draft"
        :placeholder="t('exam.notesPlaceholder')"
        :rows="10"
        autoresize
        class="w-full"
      />
    </template>
    <template #footer>
      <UButton
        :label="t('common.cancel')"
        color="neutral"
        variant="ghost"
        @click="() => { open = false }"
      />
      <UButton
        :label="t('common.save')"
        @click="save"
      />
    </template>
  </USlideover>
</template>
