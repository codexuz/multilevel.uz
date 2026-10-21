<script setup lang="ts">
/** The review's top bar: back to the result, what is being reviewed, the key switch and full screen. */
const { t } = useI18n()
defineProps<{ back: string, title?: string | null, hideToggle?: boolean }>()
const showKey = defineModel<boolean>('showKey', { default: true })

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
  else document.exitFullscreen?.()
}
</script>

<template>
  <header class="h-14 shrink-0 flex items-center justify-between gap-2 px-2 md:px-4 border-b border-default bg-default z-20">
    <div class="flex items-center gap-2 min-w-0">
      <UButton
        :to="back"
        icon="i-lucide-arrow-left"
        :label="t('review.result')"
        color="neutral"
        variant="ghost"
        :ui="{ label: 'max-sm:hidden' }"
      />
      <UBadge
        label="Multilevel"
        color="primary"
        variant="solid"
        class="font-bold shrink-0"
      />
      <span
        v-if="title"
        class="text-sm font-semibold truncate"
      >{{ title }}</span>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <slot name="center" />
      <USwitch
        v-if="!hideToggle"
        v-model="showKey"
        color="warning"
        :label="t('review.showCorrect')"
        :ui="{ label: 'max-sm:sr-only' }"
      />
      <slot name="right" />
      <UButton
        icon="i-lucide-maximize-2"
        color="neutral"
        variant="ghost"
        :aria-label="t('exam.fullscreen')"
        class="max-sm:hidden"
        @click="toggleFullscreen"
      />
    </div>
  </header>
</template>
