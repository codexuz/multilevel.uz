<script setup lang="ts">
/**
 * Two panes side by side with the ⟷ handle between them, dragged to give either more room (on a
 * tablet they are stacked, and the handle moves the line between them up and down). On a phone,
 * given `labels`, one pane fills the screen and two tabs above switch between them; a question
 * picked in the bottom bar brings the questions' pane back.
 */
const props = withDefaults(defineProps<{ initial?: number, min?: number, labels?: [string, string] }>(), { initial: 50, min: 20, labels: undefined })

const tab = ref<'left' | 'right'>('left')
const focus = inject(QUESTION_FOCUS, null)
if (focus) watch(focus.current, (n) => { if (n != null) tab.value = 'right' })

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
  <div class="ix-splitbox">
    <div
      v-if="labels"
      class="ix-tabs"
      role="tablist"
      data-testid="pane-tabs"
    >
      <button
        v-for="(label, i) in labels"
        :key="label"
        type="button"
        role="tab"
        class="ix-tab"
        :class="{ 'is-current': tab === (i ? 'right' : 'left') }"
        :aria-selected="tab === (i ? 'right' : 'left')"
        :data-testid="`pane-tab-${i ? 'right' : 'left'}`"
        @click="tab = i ? 'right' : 'left'"
      >
        {{ label }}
      </button>
    </div>
    <div
      ref="root"
      class="ix-split"
      :class="labels && `is-tabbed shows-${tab}`"
    >
      <div
        class="ix-pane is-left"
        :style="{ flex: `0 0 calc(${share}% - 1px)` }"
        data-testid="pane-left"
      >
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
          <UIcon
            name="i-lucide-move-horizontal"
            class="size-4"
          />
        </button>
      </div>
      <div
        class="ix-pane is-right"
        :style="{ flex: '1 1 0' }"
        data-testid="pane-right"
      >
        <slot name="right" />
      </div>
    </div>
  </div>
</template>
