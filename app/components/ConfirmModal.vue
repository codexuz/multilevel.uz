<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  color?: 'error' | 'primary' | 'warning'
  icon?: string
}>(), { confirmLabel: undefined, color: 'error', icon: 'i-lucide-triangle-alert' })
const { t } = useI18n()

const emit = defineEmits<{ close: [value: boolean] }>()
</script>

<template>
  <UModal
    :title="title"
    :close="false"
    :ui="{ content: 'max-w-sm', footer: 'justify-end' }"
    @update:open="(v: boolean) => !v && emit('close', false)"
  >
    <template #body>
      <div class="flex gap-3">
        <UIcon
          :name="icon"
          class="size-6 shrink-0"
          :class="color === 'error' ? 'text-error' : color === 'warning' ? 'text-warning' : 'text-primary'"
        />
        <p class="text-sm text-muted">
          {{ description }}
        </p>
      </div>
    </template>
    <template #footer>
      <UButton
        :label="t('common.cancel')"
        color="neutral"
        variant="outline"
        @click="emit('close', false)"
      />
      <UButton
        :label="confirmLabel ?? t('common.confirm')"
        :color="color"
        @click="emit('close', true)"
      />
    </template>
  </UModal>
</template>
