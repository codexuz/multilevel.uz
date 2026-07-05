<script setup lang="ts">
// Two-pane horizontal split with a draggable divider. On small screens it
// stacks vertically and the handle is hidden.
const props = withDefaults(defineProps<{
  initial?: number // initial left width as % (0-100)
  min?: number // min % for either pane
  storageKey?: string // persist ratio in localStorage
}>(), { initial: 50, min: 20 })

const left = ref(props.initial)
const container = ref<HTMLElement>()
const dragging = ref(false)

onMounted(() => {
  if (props.storageKey) {
    const saved = Number(localStorage.getItem(props.storageKey))
    if (saved >= props.min && saved <= 100 - props.min) left.value = saved
  }
})

function onDown(e: PointerEvent) {
  dragging.value = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging.value || !container.value) return
  const rect = container.value.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  left.value = Math.min(100 - props.min, Math.max(props.min, pct))
}
function onUp() {
  if (!dragging.value) return
  dragging.value = false
  if (props.storageKey) localStorage.setItem(props.storageKey, String(Math.round(left.value)))
}
</script>

<template>
  <div
    ref="container"
    class="flex flex-col lg:flex-row gap-4 lg:gap-0"
    :class="dragging ? 'select-none cursor-col-resize' : ''"
  >
    <div
      class="min-w-0 lg:overflow-auto"
      :style="{ flexBasis: `${left}%` }"
    >
      <slot name="left" />
    </div>

    <div
      class="hidden lg:flex items-center justify-center w-3 shrink-0 cursor-col-resize group"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <div class="w-px h-full bg-default group-hover:bg-primary transition-colors relative">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-muted group-hover:bg-primary" />
      </div>
    </div>

    <div
      class="min-w-0 lg:flex-1 lg:overflow-auto"
      :style="{ flexBasis: `${100 - left}%` }"
    >
      <slot name="right" />
    </div>
  </div>
</template>
