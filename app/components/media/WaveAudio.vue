<script setup lang="ts">
/**
 * An audio player in the manner of a Telegram voice message: a round play button, the sound's
 * waveform (the played part in the accent colour) to tap or drag to a moment, the time, and a speed
 * pill (1×, 1.5×, 2×, 0.75×). The waveform is read from the file itself where the browser may
 * (same site, or a host that allows it), else drawn from the address so it stays the same each time.
 * Keyboard: Space plays or pauses, arrows move 5 seconds. One player plays at a time.
 */
const props = withDefaults(defineProps<{ src: string, title?: string | null, bars?: number }>(), { title: null, bars: 64 })
const { t } = useI18n()

const audio = ref<HTMLAudioElement>()
const wave = ref<HTMLElement>()
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const rate = ref(1)
const failed = ref(false)
const waiting = ref(false)
const RATES = [1, 1.5, 2, 0.75]
const id = Math.random().toString(36).slice(2)

/** A steady made-up waveform for when the file cannot be read: the same address, the same shape. */
function drawnPeaks(seed: string, n: number) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return Array.from({ length: n }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    const r = ((h >>> 0) % 1000) / 1000
    return 0.2 + 0.8 * r * (0.55 + 0.45 * Math.sin((i / n) * Math.PI))
  })
}
const peaks = ref<number[]>(drawnPeaks(props.src, props.bars))

/** The real waveform: the loudest moments of each slice of the sound. */
async function readPeaks(signal: AbortSignal) {
  try {
    const res = await fetch(props.src, { signal })
    if (!res.ok || Number(res.headers.get('content-length') ?? 0) > 30_000_000) return
    const buf = await res.arrayBuffer()
    const ctx = new OfflineAudioContext(1, 1, 44_100)
    const decoded = await ctx.decodeAudioData(buf)
    const data = decoded.getChannelData(0)
    const step = Math.floor(data.length / props.bars)
    const raw = Array.from({ length: props.bars }, (_, i) => {
      let sum = 0
      for (let j = i * step; j < (i + 1) * step; j += 16) sum += data[j]! * data[j]!
      return Math.sqrt(sum / (step / 16))
    })
    const max = Math.max(...raw, 0.0001)
    peaks.value = raw.map(v => 0.14 + 0.86 * (v / max))
  } catch {
    // Not readable here (another site that does not allow it): keep the drawn waveform.
  }
}

let abort: AbortController | null = null
onMounted(() => {
  abort = new AbortController()
  readPeaks(abort.signal)
  window.addEventListener(MEDIA_PLAY_EVENT, onOtherPlay)
})
onBeforeUnmount(() => {
  abort?.abort()
  window.removeEventListener(MEDIA_PLAY_EVENT, onOtherPlay)
})
watch(() => props.src, () => {
  playing.value = false
  current.value = 0
  failed.value = false
  peaks.value = drawnPeaks(props.src, props.bars)
  abort?.abort()
  abort = new AbortController()
  readPeaks(abort.signal)
})
function onOtherPlay(e: Event) {
  if ((e as CustomEvent<string>).detail !== id) audio.value?.pause()
}

async function toggle() {
  const a = audio.value
  if (!a) return
  if (!a.paused) return a.pause()
  try {
    window.dispatchEvent(new CustomEvent(MEDIA_PLAY_EVENT, { detail: id }))
    await a.play()
  } catch {
    failed.value = true
  }
}
function seekTo(seconds: number) {
  const a = audio.value
  if (!a || !duration.value) return
  a.currentTime = Math.min(duration.value, Math.max(0, seconds))
  current.value = a.currentTime
}
function cycleRate() {
  rate.value = RATES[(RATES.indexOf(rate.value) + 1) % RATES.length]!
  if (audio.value) audio.value.playbackRate = rate.value
}

// ---- tapping or dragging on the waveform ----
let dragging = false
function ratioAt(e: PointerEvent) {
  const r = wave.value!.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
}
function down(e: PointerEvent) {
  if (!duration.value) return
  dragging = true
  wave.value?.setPointerCapture(e.pointerId)
  seekTo(ratioAt(e) * duration.value)
}
function move(e: PointerEvent) {
  if (dragging) seekTo(ratioAt(e) * duration.value)
}
function up(e: PointerEvent) {
  dragging = false
  wave.value?.releasePointerCapture(e.pointerId)
}
function key(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') seekTo(current.value + 5)
  else if (e.key === 'ArrowLeft') seekTo(current.value - 5)
  else if (e.key === ' ' || e.key === 'Enter') toggle()
  else return
  e.preventDefault()
}

const progress = computed(() => (duration.value ? current.value / duration.value : 0))
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-2xl bg-elevated/60 ring ring-default p-3 pe-4"
    data-testid="wave-audio"
  >
    <button
      type="button"
      class="grid place-items-center size-12 shrink-0 rounded-full bg-primary text-inverted shadow-sm transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
      :aria-label="playing ? t('media.pause') : t('media.play')"
      :disabled="failed"
      @click="toggle"
    >
      <UIcon
        v-if="waiting && playing"
        name="i-lucide-loader-circle"
        class="size-5 animate-spin"
      />
      <UIcon
        v-else
        :name="playing ? 'i-lucide-pause' : 'i-lucide-play'"
        class="size-5"
        :class="playing ? '' : 'translate-x-px'"
      />
    </button>

    <div class="flex-1 min-w-0">
      <p
        v-if="title"
        class="text-sm font-medium text-highlighted truncate mb-1"
      >
        {{ title }}
      </p>
      <div
        ref="wave"
        class="relative flex items-center gap-[2px] h-9 cursor-pointer touch-none select-none rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        role="slider"
        tabindex="0"
        :aria-label="t('media.position')"
        :aria-valuemin="0"
        :aria-valuemax="Math.round(duration)"
        :aria-valuenow="Math.round(current)"
        :aria-valuetext="`${clockTime(current)} / ${clockTime(duration)}`"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
        @keydown="key"
      >
        <span
          v-for="(p, i) in peaks"
          :key="i"
          class="flex-1 min-w-[2px] rounded-full transition-colors duration-150"
          :class="(i + 0.5) / peaks.length <= progress ? 'bg-primary' : 'bg-primary/25'"
          :style="{ height: `${Math.round(p * 100)}%` }"
        />
      </div>
      <div class="flex items-center gap-2 mt-1 text-xs text-muted tabular-nums">
        <span>{{ clockTime(playing || current ? current : duration) }}<template v-if="playing || current"> / {{ clockTime(duration) }}</template></span>
        <span
          v-if="failed"
          class="text-error"
        >{{ t('media.cannotPlay') }}</span>
        <button
          type="button"
          class="ms-auto rounded-full bg-accented/70 px-2 py-0.5 text-[11px] font-semibold text-toned hover:bg-accented focus-visible:outline-2 focus-visible:outline-primary"
          :aria-label="t('media.speed', { rate: rate })"
          @click="cycleRate"
        >
          {{ rate }}×
        </button>
      </div>
    </div>

    <audio
      ref="audio"
      :src="src"
      preload="metadata"
      class="hidden"
      @loadedmetadata="duration = ($event.target as HTMLAudioElement).duration"
      @durationchange="duration = ($event.target as HTMLAudioElement).duration"
      @timeupdate="current = ($event.target as HTMLAudioElement).currentTime"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false; current = 0"
      @waiting="waiting = true"
      @playing="waiting = false"
      @error="failed = true"
    />
  </div>
</template>
