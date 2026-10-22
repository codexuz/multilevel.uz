<script setup lang="ts">
/**
 * The Notes panel: every note written on the text in this test, each with the part it is in and the
 * words it is about, to be changed or deleted. Notes are made from the text (select words → Note).
 */
const chrome = useIxChrome()!
const list = ref<HTMLElement>()
/** The note being written in, shown in blue as the test does. */
const active = ref<string | null>(null)
/** Long quotes cut to three lines until "Show more". */
const open = ref(new Set<string>())
function toggle(id: string) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}

// A note just made from the text: bring it into view and put the cursor in it.
watch(chrome.focusNote, async (id) => {
  if (!id) return
  await nextTick()
  const field = list.value?.querySelector<HTMLTextAreaElement>(`[data-note="${id}"] textarea`)
  field?.scrollIntoView({ block: 'nearest' })
  field?.focus()
  chrome.focusNote.value = null
}, { immediate: true })
</script>

<template>
  <aside class="ix-notes" aria-label="Notes" data-testid="notes-panel">
    <div class="ix-notes-head">
      <span>Notes</span>
      <button type="button" aria-label="Close notes" @click="chrome.notesOpen.value = false">
        <UIcon name="i-lucide-x" class="size-5" />
      </button>
    </div>
    <div ref="list" class="ix-notes-list">
      <p v-if="!chrome.notes.value.length" class="ix-notes-empty">
        To add a note, select words in the text and choose Note.
      </p>
      <div
        v-for="note in chrome.notes.value"
        :key="note.id"
        class="ix-note"
        :class="{ 'is-active': active === note.id }"
        :data-note="note.id"
        @focusin="active = note.id"
        @focusout="active = null"
      >
        <p class="ix-note-head ix-note-quote" :class="{ 'is-open': open.has(note.id) }">
          <strong>{{ note.part }}</strong><em>{{ note.quote }}</em>
        </p>
        <button v-if="note.quote.length > 90" type="button" class="ix-note-more" @mousedown.prevent @click="toggle(note.id)">
          {{ open.has(note.id) ? 'Show less' : 'Show more' }}
        </button>
        <textarea
          :value="note.comment.trim() ? note.comment : ''"
          rows="2"
          placeholder="Start typing your note"
          :aria-label="`Note on “${note.quote}”`"
          @input="chrome.setComment(note.id, ($event.target as HTMLTextAreaElement).value)"
        />
        <button type="button" class="ix-note-delete" @click="note.remove()">
          Delete
        </button>
      </div>
    </div>
  </aside>
</template>
