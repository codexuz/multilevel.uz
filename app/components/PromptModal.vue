<script setup lang="ts">
const props = defineProps<{
  title: string
  label?: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  multiline?: boolean
}>()

const emit = defineEmits<{ close: [value: string | null] }>()
const { t } = useI18n()
const value = ref(props.initialValue ?? '')
</script>

<template>
  <UModal
    :title="title"
    :close="false"
    :ui="{ footer: 'justify-end' }"
    @update:open="(v: boolean) => !v && emit('close', null)"
  >
    <template #body>
      <UForm
        :state="{ value }"
        @submit="emit('close', value)"
      >
        <UFormField :label="label">
          <UTextarea
            v-if="multiline"
            v-model="value"
            :placeholder="placeholder"
            autoresize
            class="w-full"
            autofocus
          />
          <UInput
            v-else
            v-model="value"
            :placeholder="placeholder"
            class="w-full"
            autofocus
          />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton
        :label="t('common.cancel')"
        color="neutral"
        variant="outline"
        @click="emit('close', null)"
      />
      <UButton
        :label="confirmLabel || t('common.save')"
        @click="emit('close', value)"
      />
    </template>
  </UModal>
</template>
