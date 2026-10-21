<script setup lang="ts">
/**
 * Lines over days, on one y scale: 2px lines, a legend for two or more series and a label at each
 * line's end, a crosshair and tooltip on hover, and the numbers as a table underneath.
 */
const props = withDefaults(defineProps<{
  labels: string[]
  series: { key: string, label: string, values: number[] }[]
  format?: (n: number) => string
  height?: number
}>(), { format: (n: number) => n.toLocaleString('en-US'), height: 220 })

const wrap = ref<HTMLElement | null>(null)
const width = ref(640)
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = Math.max(280, Math.round(e!.contentRect.width))))
  if (wrap.value) ro.observe(wrap.value)
})
onBeforeUnmount(() => ro?.disconnect())

const pad = computed(() => ({ l: 36, r: props.series.length <= 4 ? 84 : 12, t: 10, b: 24 }))
const n = computed(() => props.labels.length)
const scale = computed(() => niceScale(Math.max(1, ...props.series.flatMap(s => s.values))))
const plotW = computed(() => width.value - pad.value.l - pad.value.r)
const plotH = computed(() => props.height - pad.value.t - pad.value.b)
const x = (i: number) => pad.value.l + (n.value > 1 ? (i * plotW.value) / (n.value - 1) : plotW.value / 2)
const y = (v: number) => pad.value.t + plotH.value - (v / scale.value.max) * plotH.value
const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

const xTicks = computed(() => {
  const count = Math.min(n.value, width.value < 480 ? 4 : 7)
  if (count < 2) return n.value ? [0] : []
  return Array.from({ length: count }, (_, k) => Math.round((k * (n.value - 1)) / (count - 1)))
})

// End labels, nudged apart so they never overlap.
const ends = computed(() => {
  const items = props.series.map((s, k) => ({ k, label: s.label, y: y(s.values[s.values.length - 1] ?? 0) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < items.length; i++) if (items[i]!.y - items[i - 1]!.y < 13) items[i]!.y = items[i - 1]!.y + 13
  return items
})

const hover = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const box = (e.currentTarget as SVGElement).getBoundingClientRect()
  const px = ((e.clientX - box.left) / box.width) * width.value
  hover.value = Math.min(n.value - 1, Math.max(0, Math.round(((px - pad.value.l) / plotW.value) * (n.value - 1))))
}
const tipLeft = computed(() => (hover.value == null ? 0 : x(hover.value)))
</script>

<template>
  <div class="viz flex flex-col gap-2">
    <div
      v-if="series.length > 1"
      class="flex flex-wrap gap-x-4 gap-y-1 text-xs"
      style="color: var(--viz-ink-2)"
    >
      <span
        v-for="(s, k) in series"
        :key="s.key"
        class="inline-flex items-center gap-1.5"
      ><span
        class="size-2.5 rounded-sm"
        :style="{ background: `var(--viz-s${k + 1})` }"
      />{{ s.label }}</span>
    </div>
    <div
      ref="wrap"
      class="relative"
    >
      <svg
        :viewBox="`0 0 ${width} ${height}`"
        :height="height"
        class="w-full block touch-none select-none"
        role="img"
        :aria-label="series.map(s => s.label).join(' and ') + ' by day'"
        @pointermove="onMove"
        @pointerleave="hover = null"
      >
        <g>
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
              class="tabular-nums"
              font-size="10"
              fill="var(--viz-muted)"
            >{{ compact(t) }}</text>
          </template>
          <text
            v-for="i in xTicks"
            :key="i"
            :x="x(i)"
            :y="height - 6"
            :text-anchor="i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'"
            font-size="10"
            fill="var(--viz-muted)"
          >{{ shortDay(labels[i]!) }}</text>
        </g>
        <path
          v-for="(s, k) in series"
          :key="s.key"
          :d="path(s.values)"
          fill="none"
          :stroke="`var(--viz-s${k + 1})`"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <template v-if="series.length <= 4">
          <g
            v-for="e in ends"
            :key="e.k"
          >
            <circle
              :cx="x(n - 1)"
              :cy="y(series[e.k]!.values[n - 1] ?? 0)"
              r="4"
              :fill="`var(--viz-s${e.k + 1})`"
              stroke="var(--viz-surface)"
              stroke-width="2"
            />
            <text
              :x="x(n - 1) + 8"
              :y="e.y + 3.5"
              font-size="11"
              fill="var(--viz-ink-2)"
            >{{ e.label }}</text>
          </g>
        </template>
        <g v-if="hover != null">
          <line
            :x1="x(hover)"
            :x2="x(hover)"
            :y1="pad.t"
            :y2="pad.t + plotH"
            stroke="var(--viz-axis)"
            stroke-width="1"
          />
          <circle
            v-for="(s, k) in series"
            :key="s.key"
            :cx="x(hover)"
            :cy="y(s.values[hover] ?? 0)"
            r="4"
            :fill="`var(--viz-s${k + 1})`"
            stroke="var(--viz-surface)"
            stroke-width="2"
          />
        </g>
      </svg>
      <div
        v-if="hover != null"
        class="viz-tip"
        :style="{ left: `${tipLeft}px`, transform: tipLeft > width / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }"
      >
        <p class="font-medium">
          {{ longDay(labels[hover]!) }}
        </p>
        <p
          v-for="(s, k) in series"
          :key="s.key"
          class="flex items-center gap-1.5"
        >
          <span
            class="size-2 rounded-sm"
            :style="{ background: `var(--viz-s${k + 1})` }"
          />
          <span style="color: var(--viz-ink-2)">{{ s.label }}</span>
          <span class="ms-auto ps-3 tabular-nums font-medium">{{ format(s.values[hover] ?? 0) }}</span>
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
          <thead>
            <tr style="color: var(--viz-muted)">
              <th class="text-left font-medium py-1">
                Day
              </th>
              <th
                v-for="s in series"
                :key="s.key"
                class="text-right font-medium py-1"
              >
                {{ s.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(d, i) in labels"
              :key="d"
              class="border-t border-default"
            >
              <td class="py-1">
                {{ longDay(d) }}
              </td>
              <td
                v-for="s in series"
                :key="s.key"
                class="text-right py-1"
              >
                {{ format(s.values[i] ?? 0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
