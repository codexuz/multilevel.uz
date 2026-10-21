<script setup lang="ts">
/**
 * One value per day as bars: rounded tops anchored to the baseline, a 2px gap between bars, a
 * tooltip on hover, and the numbers as a table underneath.
 */
const props = withDefaults(defineProps<{
  labels: string[]
  values: number[]
  label: string
  format?: (n: number) => string
  height?: number
}>(), { format: (n: number) => n.toLocaleString('en-US'), height: 200 })

const wrap = ref<HTMLElement | null>(null)
const width = ref(640)
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = Math.max(280, Math.round(e!.contentRect.width))))
  if (wrap.value) ro.observe(wrap.value)
})
onBeforeUnmount(() => ro?.disconnect())

const pad = { l: 40, r: 8, t: 10, b: 24 }
const n = computed(() => props.labels.length)
const scale = computed(() => niceScale(Math.max(1, ...props.values)))
const plotW = computed(() => width.value - pad.l - pad.r)
const plotH = computed(() => props.height - pad.t - pad.b)
const step = computed(() => plotW.value / Math.max(1, n.value))
const barW = computed(() => Math.max(1, Math.min(28, step.value - 2)))
const bx = (i: number) => pad.l + i * step.value + (step.value - barW.value) / 2
const y = (v: number) => pad.t + plotH.value - (v / scale.value.max) * plotH.value
const base = computed(() => pad.t + plotH.value)

/** A bar with rounded top corners only, standing on the baseline. */
function bar(i: number, v: number) {
  const x0 = bx(i)
  const w = barW.value
  const top = y(v)
  const r = Math.min(4, w / 2, base.value - top)
  return `M${x0},${base.value} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + w - r} Q${x0 + w},${top} ${x0 + w},${top + r} V${base.value} Z`
}

const xTicks = computed(() => {
  const count = Math.min(n.value, width.value < 480 ? 4 : 7)
  if (count < 2) return n.value ? [0] : []
  return Array.from({ length: count }, (_, k) => Math.round((k * (n.value - 1)) / (count - 1)))
})

const hover = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const box = (e.currentTarget as SVGElement).getBoundingClientRect()
  const px = ((e.clientX - box.left) / box.width) * width.value
  hover.value = Math.min(n.value - 1, Math.max(0, Math.floor((px - pad.l) / step.value)))
}
const tipLeft = computed(() => (hover.value == null ? 0 : bx(hover.value) + barW.value / 2))
</script>

<template>
  <div class="viz flex flex-col gap-2">
    <div
      ref="wrap"
      class="relative"
    >
      <svg
        :viewBox="`0 0 ${width} ${height}`"
        :height="height"
        class="w-full block touch-none select-none"
        role="img"
        :aria-label="`${label} by day`"
        @pointermove="onMove"
        @pointerleave="hover = null"
      >
        <template
          v-for="t in scale.ticks"
          :key="t"
        >
          <line
            :x1="pad.l"
            :x2="width - pad.r"
            :y1="y(t)"
            :y2="y(t)"
            :stroke="t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'"
            stroke-width="1"
          />
          <text
            :x="pad.l - 6"
            :y="y(t) + 3.5"
            text-anchor="end"
            font-size="10"
            fill="var(--viz-muted)"
          >{{ compact(t) }}</text>
        </template>
        <text
          v-for="i in xTicks"
          :key="i"
          :x="bx(i) + barW / 2"
          :y="height - 6"
          :text-anchor="i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'"
          font-size="10"
          fill="var(--viz-muted)"
        >{{ shortDay(labels[i]!) }}</text>
        <template
          v-for="(v, i) in values"
          :key="i"
        >
          <path
            v-if="v > 0"
            :d="bar(i, v)"
            fill="var(--viz-s1)"
            :opacity="hover == null || hover === i ? 1 : 0.45"
          />
        </template>
      </svg>
      <div
        v-if="hover != null"
        class="viz-tip"
        :style="{ left: `${tipLeft}px`, transform: tipLeft > width / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }"
      >
        <p class="font-medium">
          {{ longDay(labels[hover]!) }}
        </p>
        <p class="flex items-center gap-1.5">
          <span style="color: var(--viz-ink-2)">{{ label }}</span>
          <span class="ms-auto ps-3 tabular-nums font-medium">{{ format(values[hover] ?? 0) }}</span>
        </p>
      </div>
    </div>
    <details class="text-xs">
      <summary
        class="cursor-pointer w-fit"
        style="color: var(--viz-muted)"
      >
        Table
      </summary>
      <div class="max-h-56 overflow-auto mt-2">
        <table class="w-full tabular-nums">
          <tbody>
            <tr
              v-for="(d, i) in labels"
              :key="d"
              class="border-t border-default"
            >
              <td class="py-1">
                {{ longDay(d) }}
              </td>
              <td class="text-right py-1">
                {{ format(values[i] ?? 0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
