<script setup lang="ts">
// Wraps scrollable exam content with text-highlighting: select text to pick a
// colour, click a highlight to attach a note or remove it. Highlights are kept
// per `scope` (part id) and re-applied after the content re-renders.
import { DEFAULT_HIGHLIGHT_COLOR, useHighlighter } from '~/composables/useHighlighter'

const props = defineProps<{ scope: string }>()

const {
  containerRef,
  highlights,
  popup,
  activeHighlight,
  addHighlight,
  setNote,
  removeHighlight,
  restore,
  closePopup,
  onMouseUp
} = useHighlighter(() => props.scope)

const noteOpen = ref(false)
const noteTargetId = ref<string | null>(null)
const noteText = ref('')

function openNote(id: string | null) {
  // No id → the user picked "add note" straight from a fresh selection.
  const target = id ?? addHighlight(DEFAULT_HIGHLIGHT_COLOR)
  if (!target) return
  noteTargetId.value = target
  noteText.value = highlights.value.find(h => h.id === target)?.note ?? ''
  noteOpen.value = true
  closePopup()
}

function saveNote() {
  if (noteTargetId.value) setNote(noteTargetId.value, noteText.value.trim())
  noteOpen.value = false
}

function closeNote() {
  noteOpen.value = false
}

// Re-wrap any <mark> Vue threw away when it re-rendered the slot content.
onUpdated(restore)
</script>

<template>
  <div
    ref="containerRef"
    class="relative"
    @mouseup="onMouseUp"
  >
    <slot />

    <ExamHighlightPopup
      :popup="popup"
      :has-note="!!activeHighlight?.note"
      @highlight="addHighlight"
      @note="openNote"
      @remove="removeHighlight"
      @close="closePopup"
    />

    <UModal
      v-model:open="noteOpen"
      title="Izoh"
    >
      <template #body>
        <UTextarea
          v-model="noteText"
          :rows="8"
          class="w-full"
          placeholder="Belgilangan matn uchun izoh yozing…"
          autoresize
          autofocus
        />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            label="Bekor qilish"
            @click="closeNote"
          />
          <UButton
            color="primary"
            label="Saqlash"
            @click="saveNote"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
/* Marks are created imperatively, so these rules can't be scoped. */
.exam-highlight {
  color: #000;
  border-radius: 2px;
  cursor: pointer;
}

.exam-highlight[data-note] {
  border-bottom: 2px solid currentColor;
  padding-bottom: 1px;
}
</style>
