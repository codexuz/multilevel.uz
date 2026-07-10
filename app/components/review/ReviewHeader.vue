<script setup lang="ts">
import type { ReviewData } from '~/types/review'
import { SECTION_META } from '~/types/exam'

defineProps<{
  testTitle: string
  section: ReviewData['section']
  attempt: ReviewData['attempt']
}>()

const showAnswers = defineModel<boolean>('showAnswers', { required: true })

const LEVEL_COLOR: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  C1: 'success', B2: 'info', B1: 'warning', A2: 'neutral'
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}
</script>

<template>
  <header class="shrink-0 h-14 flex items-center justify-between gap-3 px-3 bg-default border-b border-default">
    <div class="flex items-center gap-2 min-w-0">
      <UButton
        :to="`/results/${attempt.id}`"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        label="Results"
        :ui="{ label: 'hidden sm:inline' }"
      />
      <UIcon
        :name="SECTION_META[section.type].icon"
        class="size-5 text-primary shrink-0"
      />
      <div class="min-w-0">
        <p class="text-sm font-semibold text-highlighted truncate">
          {{ testTitle }} — {{ section.title }}
        </p>
        <p class="text-xs text-muted">
          Answer review
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3 shrink-0">
      <div class="hidden sm:flex items-center gap-2">
        <UBadge
          :label="`${attempt.correctCount ?? 0} / ${attempt.totalQuestions} correct`"
          color="neutral"
          variant="subtle"
        />
        <UBadge
          v-if="attempt.level"
          :label="attempt.level"
          :color="LEVEL_COLOR[attempt.level] ?? 'neutral'"
          variant="subtle"
        />
      </div>

      <USwitch
        v-model="showAnswers"
        label="Show answers"
        :ui="{ label: 'hidden md:inline text-sm' }"
      />

      <UButton
        icon="i-lucide-maximize-2"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Toggle fullscreen"
        @click="toggleFullscreen"
      />
    </div>
  </header>
</template>
