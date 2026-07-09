<script setup lang="ts">
import type { PopupState } from '~/composables/useHighlighter'
import { HIGHLIGHT_COLORS } from '~/composables/useHighlighter'

defineProps<{
  popup: PopupState
  /** Whether the clicked highlight already carries a note. */
  hasNote: boolean
}>()

const emit = defineEmits<{
  highlight: [color: string]
  note: [id: string | null]
  remove: [id: string]
  close: []
}>()

// mousedown must not clear the text selection before we read it.
function hold(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}
</script>

<template>
  <template v-if="popup.visible">
    <!-- Click-outside catcher -->
    <div
      data-highlight-ui
      class="fixed inset-0 z-40"
      @click="emit('close')"
    />

    <div
      data-highlight-ui
      class="absolute z-50 -translate-x-1/2 flex items-center gap-1.5 rounded-lg border border-default bg-default shadow-lg px-2 py-1.5"
      :style="{ left: `${popup.x}px`, top: `${popup.y}px` }"
      @mousedown="hold"
      @mouseup.stop
      @click.stop
    >
      <template v-if="popup.highlightId">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-message-square-plus"
          :label="hasNote ? 'Izohni tahrirlash' : 'Izoh qo\'shish'"
          @mousedown="hold($event); emit('note', popup.highlightId)"
        />
        <div class="w-px h-4 bg-accented" />
        <UButton
          color="error"
          variant="ghost"
          size="xs"
          icon="i-lucide-trash-2"
          :ui="{ base: 'p-1' }"
          aria-label="O'chirish"
          title="O'chirish"
          @mousedown="hold($event); emit('remove', popup.highlightId!)"
        />
      </template>

      <template v-else>
        <button
          v-for="c in HIGHLIGHT_COLORS"
          :key="c.value"
          type="button"
          class="size-6 rounded-full border border-accented cursor-pointer transition-transform hover:scale-110"
          :style="{ backgroundColor: c.value }"
          :title="c.label"
          :aria-label="c.label"
          @mousedown="hold($event); emit('highlight', c.value)"
        />
        <div class="w-px h-4 bg-accented" />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-message-square-plus"
          :ui="{ base: 'p-1' }"
          aria-label="Izoh qo'shish"
          title="Izoh qo'shish"
          @mousedown="hold($event); emit('note', null)"
        />
      </template>
    </div>
  </template>
</template>
