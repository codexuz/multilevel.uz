<script setup lang="ts">
/**
 * Text a candidate can mark up as in the computer-delivered IELTS: select words and a small toolbar
 * offers Note and Highlight; click a highlight and it offers Delete Highlight (and a note for it).
 * Notes go to the Notes panel of the test, under the part they were made in. With `saveWords`, and a
 * signed-in student, it also offers Save word (My Words: useWordSaver).
 */
const props = defineProps<{
  /** Offer Save word for a word or short phrase selected here. */
  saveWords?: boolean
  /** The part the text belongs to, kept with a saved word. */
  partId?: string
}>()
const { container, highlights, popup, addHighlight, updateComment, removeHighlight, closePopup, onMouseUp, selection } = useHighlighter()
const chrome = useIxChrome()
const pick = useWordPick()
const { t } = useI18n()
const canSaveWord = computed(() => props.saveWords && popup.value.visible && !popup.value.highlightId && pick.canSave(selection()))

function saveWord() {
  const range = selection()
  closePopup()
  pick.saveRange(range, props.partId)
}

function highlight() {
  addHighlight('')
}

/** A note on the words selected (or on a highlight): they are marked, and the note opens in the panel. */
function note(existing: string | null) {
  const id = existing ?? addHighlight('')
  if (!id || !chrome) return closePopup()
  if (!chrome.notes.value.some(n => n.id === id)) {
    const entry = highlights.value.find(h => h.id === id)
    chrome.addNote({
      id,
      part: chrome.partLabel.value,
      quote: entry?.text ?? '',
      comment: entry?.comment ?? '',
      remove: () => forget(id)
    })
  }
  updateComment(id, ' ')
  chrome.notesOpen.value = true
  chrome.focusNote.value = id
  closePopup()
}

/** A highlight taken off the text goes with its note. */
function forget(id: string) {
  removeHighlight(id)
  if (chrome) chrome.notes.value = chrome.notes.value.filter(n => n.id !== id)
}

// The note's text kept with the highlight, so it is marked as one with a note.
watch(() => chrome?.notes.value, (notes) => {
  for (const n of notes ?? []) {
    if (highlights.value.some(h => h.id === n.id)) updateComment(n.id, n.comment || ' ')
  }
}, { deep: true })

function onContextMenu(e: MouseEvent) {
  const sel = window.getSelection()
  const onMark = (e.target as HTMLElement).closest('mark.exam-highlight')
  if (onMark || (sel && !sel.isCollapsed && sel.toString().trim())) {
    e.preventDefault()
    onMouseUp(e)
  }
}
</script>

<template>
  <div
    ref="container"
    class="relative min-h-full"
    @mouseup="onMouseUp"
    @contextmenu="onContextMenu"
  >
    <slot />

    <template v-if="popup.visible">
      <div
        class="fixed inset-0 z-40"
        @mousedown="closePopup"
      />
      <div
        class="ix-adder"
        role="toolbar"
        aria-label="Text tools"
        :style="{ left: `${popup.x}px`, top: `${popup.y}px` }"
        data-testid="adder"
        @mousedown.prevent.stop
        @mouseup.stop
        @click.stop
      >
        <template v-if="popup.highlightId">
          <button
            type="button"
            @click="note(popup.highlightId)"
          >
            <UIcon name="i-lucide-message-square-quote" />Note
          </button>
          <button
            type="button"
            data-testid="delete-highlight"
            @click="forget(popup.highlightId!)"
          >
            <UIcon name="i-lucide-trash-2" />Delete<br>Highlight
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            data-testid="add-note"
            @click="note(null)"
          >
            <UIcon name="i-lucide-message-square-quote" />Note
          </button>
          <button
            type="button"
            data-testid="add-highlight"
            @click="highlight"
          >
            <UIcon name="i-lucide-highlighter" />Highlight
          </button>
          <button
            v-if="canSaveWord"
            type="button"
            data-testid="save-word"
            @click="saveWord"
          >
            <UIcon name="i-lucide-book-plus" />{{ t('words.saveShort') }}<br>{{ t('words.wordShort') }}
          </button>
        </template>
      </div>
    </template>

    <WordsPopover
      v-if="pick.card.value"
      :anchor="pick.card.value.anchor"
      :word="pick.card.value.word"
      :loading="pick.card.value.loading"
      :text="pick.card.value.text"
      @close="pick.close"
      @removed="pick.close"
    />
  </div>
</template>
