<script setup lang="ts">
/**
 * Text a student can pick words out of, to save to My Words (the review of a marked paper): select
 * a word or a short phrase and a Save word button shows under it; pressed, the word's card opens.
 */
const props = defineProps<{ partId?: string | null }>()
const { t } = useI18n()
const pick = useWordPick()
const button = ref<{ x: number, y: number } | null>(null)
let range: Range | null = null

function onMouseUp(e: Event) {
  if ((e.target as HTMLElement).closest('input, textarea, select, button, a')) return
  // After the browser has settled the selection (a click inside one clears it only then).
  requestAnimationFrame(() => {
    const sel = window.getSelection()
    const r = sel && !sel.isCollapsed && sel.rangeCount ? sel.getRangeAt(0) : null
    if (!r || !pick.canSave(r)) {
      button.value = null
      range = null
      return
    }
    range = r.cloneRange()
    const box = r.getBoundingClientRect()
    button.value = { x: box.left + box.width / 2, y: box.bottom + 6 }
  })
}

function save() {
  const r = range
  button.value = null
  range = null
  pick.saveRange(r, props.partId)
}

function hide() {
  button.value = null
}
onMounted(() => document.addEventListener('scroll', hide, true))
onBeforeUnmount(() => document.removeEventListener('scroll', hide, true))
</script>

<template>
  <div
    @mouseup="onMouseUp"
    @touchend="onMouseUp"
  >
    <slot />
    <Teleport
      v-if="button && pick.available.value"
      to="body"
    >
      <UButton
        class="fixed z-[59] -translate-x-1/2 shadow-md"
        :style="{ left: `${button.x}px`, top: `${button.y}px` }"
        :label="t('words.save')"
        icon="i-lucide-book-plus"
        size="sm"
        data-testid="save-word"
        @mousedown.prevent.stop
        @click="save"
      />
    </Teleport>
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
