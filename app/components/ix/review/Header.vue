<script setup lang="ts">
import type { Skill } from '~/types/ielts'

/**
 * The review's top bar, the test's own: Mockmee's mark and whose paper it is, the sections to move
 * between in the middle, and on the right the key switch, the band, full screen and the way out.
 */
defineProps<{
  back: string
  title?: string | null
  candidate?: string | null
  sections?: Skill[]
  hideToggle?: boolean
}>()
const showKey = defineModel<boolean>('showKey', { default: true })
const skill = defineModel<Skill | null>('skill', { default: null })
const { t } = useI18n()

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
  else document.exitFullscreen?.()
}
</script>

<template>
  <header class="ix-header">
    <NuxtLink :to="back" class="ix-logo" aria-label="Mockmee">
      <img src="/icon.svg" alt="" class="ix-logo-mark">
      <span>Mockmee</span>
    </NuxtLink>
    <div class="ix-candidate">
      <strong data-testid="candidate">{{ candidate || 'Test taker' }}</strong>
      <small><UIcon name="i-lucide-file-check" class="size-3.5" />{{ t('ixReview.review') }}<template v-if="title"> · {{ title }}</template></small>
    </div>

    <div v-if="sections && sections.length > 1" class="ix-sections" role="tablist" aria-label="Sections">
      <button
        v-for="s in sections"
        :key="s"
        type="button"
        role="tab"
        class="ix-section"
        :class="{ 'is-current': s === skill }"
        :aria-selected="s === skill"
        @click="skill = s"
      >
        {{ SKILL_META[s].label }}
      </button>
    </div>

    <div class="ix-icons">
      <label v-if="!hideToggle" class="ix-keyswitch" data-testid="show-key">
        <input v-model="showKey" type="checkbox">
        <UIcon name="i-lucide-key-round" class="ix-keyswitch-icon size-4" />
        <span class="ix-keyswitch-label">{{ t('ixReview.showKey') }}</span>
      </label>
      <slot name="right" />
      <button type="button" class="ix-icon ix-fullscreen" aria-label="Full screen" title="Full screen" @click="toggleFullscreen">
        <UIcon name="i-lucide-maximize-2" />
      </button>
      <NuxtLink :to="back" class="ix-icon" aria-label="Close the review" title="Close the review">
        <UIcon name="i-lucide-x" />
      </NuxtLink>
    </div>
  </header>
</template>
