<script setup lang="ts">
import { CONTRAST_OPTIONS } from '~/composables/useExamSettings'

const open = defineModel<boolean>('open', { default: false })

const {
  settings,
  scalePercent,
  canIncrease,
  canDecrease,
  increase,
  decrease,
  setContrast,
  reset
} = useExamSettings()

function close() {
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Ko'rinish sozlamalari"
  >
    <template #body>
      <div class="space-y-6">
        <div class="space-y-2">
          <p class="text-sm font-medium text-highlighted">
            Matn o'lchami
          </p>
          <div class="flex items-center gap-3">
            <UButton
              icon="i-lucide-minus"
              color="neutral"
              variant="outline"
              :disabled="!canDecrease"
              aria-label="Kichiklashtirish"
              @click="decrease"
            />
            <span class="min-w-16 text-center font-mono text-sm">{{ scalePercent }}%</span>
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              :disabled="!canIncrease"
              aria-label="Kattalashtirish"
              @click="increase"
            />
            <span class="text-sm text-muted">Namuna matni</span>
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium text-highlighted">
            Rang rejimi
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in CONTRAST_OPTIONS"
              :key="opt.value"
              type="button"
              class="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors"
              :class="settings.contrast === opt.value
                ? 'border-primary ring-2 ring-primary/40'
                : 'border-default hover:border-accented'"
              @click="setContrast(opt.value)"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-md border border-accented text-sm font-bold"
                :style="{ backgroundColor: opt.bg, color: opt.fg }"
              >Aa</span>
              <span class="text-sm">{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-between">
        <UButton
          color="neutral"
          variant="ghost"
          label="Tiklash"
          @click="reset"
        />
        <UButton
          color="primary"
          label="Yopish"
          @click="close"
        />
      </div>
    </template>
  </UModal>
</template>
