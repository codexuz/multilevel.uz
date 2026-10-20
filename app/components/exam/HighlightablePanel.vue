<script setup lang="ts">
const COLORS = [
  { value: '#fef08a', label: 'Yellow' },
  { value: '#bbf7d0', label: 'Green' },
  { value: '#fbcfe8', label: 'Pink' },
  { value: '#bfdbfe', label: 'Blue' }
]

const { container, highlights, popup, addHighlight, updateComment, removeHighlight, closePopup, onMouseUp } = useHighlighter()

const noteOpen = ref(false)
const activeId = ref<string | null>(null)
const activeComment = computed(() => highlights.value.find(h => h.id === activeId.value)?.comment ?? '')

function openNote(id: string | null) {
  const target = id ?? addHighlight('#fef08a')
  if (!target) return
  activeId.value = target
  noteOpen.value = true
  closePopup()
}

function saveNote(text: string) {
  if (activeId.value) updateComment(activeId.value, text)
}
</script>

<template>
  <div
    ref="container"
    class="relative h-full"
    @mouseup="onMouseUp"
  >
    <slot />

    <template v-if="popup.visible">
      <div
        class="fixed inset-0 z-40"
        @click="closePopup"
      />
      <UCard
        class="absolute z-50 -translate-x-1/2 shadow-lg"
        :style="{ left: `${popup.x}px`, top: `${popup.y}px` }"
        :ui="{ body: 'p-1 sm:p-1 flex items-center gap-1' }"
        @mousedown.prevent.stop
        @mouseup.stop
        @click.stop
      >
        <template v-if="popup.highlightId">
          <UTooltip text="Add / edit note">
            <UButton
              icon="i-lucide-message-square-plus"
              color="neutral"
              variant="ghost"
              size="sm"
              @mousedown.prevent.stop="openNote(popup.highlightId)"
            />
          </UTooltip>
          <UTooltip text="Remove highlight">
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @mousedown.prevent.stop="removeHighlight(popup.highlightId!)"
            />
          </UTooltip>
        </template>
        <template v-else>
          <UTooltip
            v-for="c in COLORS"
            :key="c.value"
            :text="c.label"
          >
            <UButton
              size="sm"
              variant="outline"
              color="neutral"
              square
              class="rounded-full size-6 p-0"
              :style="{ backgroundColor: c.value }"
              :aria-label="`Highlight ${c.label}`"
              @mousedown.prevent.stop="addHighlight(c.value)"
            />
          </UTooltip>
          <USeparator
            orientation="vertical"
            class="h-4 mx-1"
          />
          <UTooltip text="Add note">
            <UButton
              icon="i-lucide-message-square-plus"
              color="neutral"
              variant="ghost"
              size="sm"
              @mousedown.prevent.stop="openNote(null)"
            />
          </UTooltip>
        </template>
      </UCard>
    </template>

    <ExamNotesSlideover
      v-model:open="noteOpen"
      title="Highlight note"
      :model-value="activeComment"
      @update:model-value="saveNote"
    />
  </div>
</template>
