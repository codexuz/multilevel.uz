<script setup lang="ts">
import type { ContrastMode, TextSizeMode } from '~/composables/useExamTheme'

const { t } = useI18n()

const open = defineModel<boolean>('open', { default: false })
const theme = useExamTheme()

const contrastItems = computed<{ label: string, value: ContrastMode }[]>(() => [
  { label: t('exam.blackOnWhite'), value: 'black-on-white' },
  { label: t('exam.whiteOnBlack'), value: 'white-on-black' },
  { label: t('exam.yellowOnBlack'), value: 'yellow-on-black' }
])
const sizeItems = computed<{ label: string, value: TextSizeMode }[]>(() => [
  { label: t('exam.small'), value: 'small' },
  { label: t('exam.medium'), value: 'medium' },
  { label: t('exam.large'), value: 'large' }
])
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('exam.options')"
    :description="t('exam.optionsText')"
    :ui="{ content: 'max-w-sm' }"
  >
    <template #body>
      <div
        v-if="theme"
        class="space-y-5"
      >
        <UFormField :label="t('exam.contrast')">
          <URadioGroup
            v-model="theme.contrast.value"
            :items="contrastItems"
            variant="card"
          />
        </UFormField>
        <UFormField :label="t('exam.textSize')">
          <URadioGroup
            v-model="theme.textSize.value"
            :items="sizeItems"
            orientation="horizontal"
            variant="table"
          />
        </UFormField>
      </div>
    </template>
  </UModal>
</template>
