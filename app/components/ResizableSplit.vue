<script setup lang="ts">
// Two-pane split with a draggable divider: side-by-side on large screens,
// stacked into a vertical (top/bottom) split on small ones. The same ratio
// drives width on desktop and height on mobile, and the handle drags either.
const props = withDefaults(defineProps<{
  initial?: number // initial left/top size as % (0-100)
  min?: number // min % for either pane
  storageKey?: string // persist ratio in localStorage
}>(), { initial: 50, min: 20 })

const left = ref(props.initial)
const container = ref<HTMLElement>()
const dragging = ref(false)

// Tailwind's `lg` breakpoint — below it the split is vertical (drag on the Y axis).
function isVertical() {
  return typeof window !== 'undefined' && window.innerWidth < 1024
}

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
  const pct = isVertical()
    ? ((e.clientY - rect.top) / rect.height) * 100
    : ((e.clientX - rect.left) / rect.width) * 100
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
    class="flex flex-col lg:flex-row"
    :class="dragging ? 'select-none cursor-row-resize lg:cursor-col-resize' : ''"
  >
    <div
      class="min-w-0 min-h-0 overflow-auto"
      :style="{ flexBasis: `${left}%` }"
    >
      <slot name="left" />
    </div>

    <div
      class="flex items-center justify-center shrink-0 group touch-none
             h-3 w-full cursor-row-resize
             lg:h-full lg:w-3 lg:cursor-col-resize"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <div
        class="bg-default group-hover:bg-primary transition-colors relative
                  h-px w-full lg:h-full lg:w-px"
      >
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted group-hover:bg-primary
                    h-1 w-8 lg:h-8 lg:w-1"
        />
      </div>
    </div>

    <div
      class="min-w-0 min-h-0 flex-1 overflow-auto"
      :style="{ flexBasis: `${100 - left}%` }"
    >
      <slot name="right" />
    </div>
  </div>
</template>
