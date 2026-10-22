<script setup lang="ts">
/**
 * Two panes side by side with the ⟷ handle between them, dragged to give either more room (on a
 * narrow screen they are stacked, and the handle moves the line between them up and down).
 */
const props = withDefaults(defineProps<{ initial?: number, min?: number }>(), { initial: 50, min: 20 })

const share = ref(props.initial)
const root = ref<HTMLElement>()
let dragging = false

function vertical() {
  return root.value ? getComputedStyle(root.value).flexDirection === 'column' : false
}
function onDown(e: PointerEvent) {
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging || !root.value) return
  const box = root.value.getBoundingClientRect()
  const at = vertical() ? (e.clientY - box.top) / box.height : (e.clientX - box.left) / box.width
  share.value = Math.min(100 - props.min, Math.max(props.min, at * 100))
}
function onUp() {
  dragging = false
}
function nudge(by: number) {
  share.value = Math.min(100 - props.min, Math.max(props.min, share.value + by))
}
</script>

<template>
  <div ref="root" class="ix-split">
    <div class="ix-pane" :style="{ flex: `0 0 calc(${share}% - 1px)` }" data-testid="pane-left">
      <slot name="left" />
    </div>
    <div
      class="ix-divider"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <button
        type="button"
        aria-label="Resize the panes (arrow keys)"
        @keydown.left.prevent="nudge(-5)"
        @keydown.right.prevent="nudge(5)"
        @keydown.up.prevent="nudge(-5)"
        @keydown.down.prevent="nudge(5)"
      >
        <UIcon name="i-lucide-move-horizontal" class="size-4" />
      </button>
    </div>
    <div class="ix-pane" :style="{ flex: '1 1 0' }" data-testid="pane-right">
      <slot name="right" />
    </div>
  </div>
</template>
