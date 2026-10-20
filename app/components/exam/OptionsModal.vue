<script setup lang="ts">
import type { ContrastMode, TextSizeMode } from '~/composables/useExamTheme'

const open = defineModel<boolean>('open', { default: false })
const theme = useExamTheme()

const contrastItems: { label: string, value: ContrastMode }[] = [
  { label: 'Black on white', value: 'black-on-white' },
  { label: 'White on black', value: 'white-on-black' },
  { label: 'Yellow on black', value: 'yellow-on-black' }
]
const sizeItems: { label: string, value: TextSizeMode }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' }
]
</script>

<template>
  <UModal
    v-model:open="open"
    title="Options"
    description="Adjust how the test is displayed."
    :ui="{ content: 'max-w-sm' }"
  >
    <template #body>
      <div
        v-if="theme"
        class="space-y-5"
      >
        <UFormField label="Contrast">
          <URadioGroup
            v-model="theme.contrast.value"
            :items="contrastItems"
            variant="card"
          />
        </UFormField>
        <UFormField label="Text size">
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
