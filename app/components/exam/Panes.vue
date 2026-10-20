<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

/**
 * Two panes of a paper (passage and questions, task and answer): side by side on a wide screen,
 * stacked with a handle on a tablet, and one at a time with a switch on a phone, where half a
 * screen of each is too little to read or write in.
 */
const props = withDefaults(defineProps<{ labels: [string, string], sizes?: [number, number], minSizes?: [number, number] }>(), {
  sizes: () => [50, 50],
  minSizes: () => [20, 20]
})
const pane = defineModel<number>('pane', { default: 0 })

const wide = useMediaQuery('(min-width: 1024px)')
const phone = useMediaQuery('(max-width: 767px)')
const tabs = computed(() => props.labels.map((label, value) => ({ label, value })))
</script>

<template>
  <div
    v-if="phone"
    class="flex-1 min-h-0 flex flex-col"
  >
    <div class="shrink-0 px-3 py-2 bg-default border-b border-default">
      <UTabs
        v-model="pane"
        :items="tabs"
        :content="false"
        size="sm"
        class="w-full"
      />
    </div>
    <div
      v-show="pane === 0"
      class="flex-1 min-h-0"
    >
      <slot name="first" />
    </div>
    <div
      v-show="pane === 1"
      class="flex-1 min-h-0"
    >
      <slot name="second" />
    </div>
  </div>
  <USplitter
    v-else
    :key="String(wide)"
    :orientation="wide ? 'horizontal' : 'vertical'"
    :items="[{ slot: 'first', defaultSize: sizes[0], minSize: minSizes[0] }, { slot: 'second', defaultSize: sizes[1], minSize: minSizes[1] }]"
    class="flex-1 min-h-0"
  >
    <template #first>
      <slot name="first" />
    </template>
    <template #second>
      <slot name="second" />
    </template>
  </USplitter>
</template>
