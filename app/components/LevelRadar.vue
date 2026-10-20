<script setup lang="ts">
/**
 * The four skills on one shape, as SmallTalk2Me draws a candidate's level: each axis runs from the
 * centre (0) to the edge (75), with the skill's CEFR level beside it. A skill not taken yet sits at 0.
 */
const props = defineProps<{ scores: Partial<Record<'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING', number>> }>()

const AXES = [
  { key: 'READING', label: 'Reading', x: 0, y: -1 },
  { key: 'WRITING', label: 'Writing', x: 1, y: 0 },
  { key: 'SPEAKING', label: 'Speaking', x: 0, y: 1 },
  { key: 'LISTENING', label: 'Listening', x: -1, y: 0 }
] as const
const R = 70
const C = 110
const point = (a: { x: number, y: number }, share: number) => `${C + a.x * R * share},${C + a.y * R * share}`
const rings = [0.25, 0.5, 0.75, 1].map(s => AXES.map(a => point(a, s)).join(' '))
const shape = computed(() => AXES.map(a => point(a, Math.max(0.04, (props.scores[a.key] ?? 0) / 75))).join(' '))
const labelAt = (a: { x: number, y: number }) => ({ x: C + a.x * (R + 26), y: C + a.y * (R + 22) + (a.y === 0 ? 0 : a.y < 0 ? -2 : 8) })
</script>

<template>
  <svg
    viewBox="-28 0 276 220"
    class="w-full max-w-72 mx-auto"
    role="img"
    :aria-label="AXES.map(a => `${a.label} ${scores[a.key] ?? 'not taken'}`).join(', ')"
  >
    <polygon
      v-for="(r, i) in rings"
      :key="i"
      :points="r"
      fill="none"
      class="stroke-(--ui-border-accented)"
      stroke-width="1"
    />
    <line
      v-for="a in AXES"
      :key="a.key"
      :x1="C"
      :y1="C"
      :x2="C + a.x * R"
      :y2="C + a.y * R"
      class="stroke-(--ui-border-accented)"
      stroke-width="1"
    />
    <polygon
      :points="shape"
      class="fill-(--ui-primary)/30 stroke-(--ui-primary)"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <g
      v-for="a in AXES"
      :key="`t${a.key}`"
      :transform="`translate(${labelAt(a).x} ${labelAt(a).y})`"
      text-anchor="middle"
    >
      <text
        class="fill-(--ui-text-muted)"
        font-size="10"
        font-weight="500"
      >{{ a.label }}</text>
      <text
        y="12"
        class="fill-(--ui-text-highlighted)"
        font-size="10"
        font-weight="700"
      >{{ scores[a.key] != null ? (cefrOf(scores[a.key]) === 'A2' ? 'A2' : cefrOf(scores[a.key])) : '—' }}</text>
    </g>
  </svg>
</template>
