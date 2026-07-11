<script setup lang="ts">
import { WAVE_BARS, fallbackPeaks, peaksFromUrl } from '~/utils/waveform'

// Telegram-style voice message: play/pause, a seekable waveform, and a clock
// that shows elapsed time while playing and total duration when idle.
const props = withDefaults(defineProps<{
  src: string
  bars?: number
}>(), { bars: WAVE_BARS })

const audio = ref<HTMLAudioElement>()
const track = ref<HTMLElement>()

const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
// Seed the bars immediately so the component never renders empty, then replace
// them with the real peaks if the audio can be decoded.
const peaks = ref<number[]>(fallbackPeaks(props.src, props.bars))

const progress = computed(() => (duration.value > 0 ? currentTime.value / duration.value : 0))
const clock = computed(() => fmt(playing.value || currentTime.value > 0 ? currentTime.value : duration.value))

function fmt(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

onMounted(async () => {
  try {
    peaks.value = await peaksFromUrl(props.src, props.bars)
  } catch {
    // Storage did not allow the cross-origin read — keep the seeded waveform.
  }
})

function toggle() {
  const el = audio.value
  if (!el) return
  if (el.paused) el.play().catch(() => {})
  else el.pause()
}

function onLoaded() {
  const el = audio.value
  if (el && Number.isFinite(el.duration)) duration.value = el.duration
}

function onTimeUpdate() {
  currentTime.value = audio.value?.currentTime ?? 0
}

function onEnded() {
  playing.value = false
  currentTime.value = 0
}

function seek(event: MouseEvent) {
  const el = audio.value
  const bar = track.value
  if (!el || !bar || !duration.value) return
  const rect = bar.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  el.currentTime = ratio * duration.value
  currentTime.value = el.currentTime
}
</script>

<template>
  <div class="flex items-center gap-3 rounded-full border border-default bg-elevated/40 px-3 py-2">
    <audio
      ref="audio"
      :src="src"
      preload="metadata"
      class="hidden"
      @loadedmetadata="onLoaded"
      @durationchange="onLoaded"
      @timeupdate="onTimeUpdate"
      @play="playing = true"
      @pause="playing = false"
      @ended="onEnded"
    />

    <UButton
      :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
      color="primary"
      size="sm"
      :ui="{ base: 'rounded-full' }"
      :aria-label="playing ? 'Pause' : 'Play'"
      @click="toggle"
    />

    <div
      ref="track"
      class="flex h-8 flex-1 items-center gap-[2px] cursor-pointer"
      role="slider"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Seek"
      tabindex="0"
      @click="seek"
    >
      <span
        v-for="(peak, i) in peaks"
        :key="i"
        class="flex-1 min-w-0 max-w-[3px] rounded-full transition-colors"
        :class="i / peaks.length < progress ? 'bg-primary' : 'bg-accented'"
        :style="{ height: `${Math.round(peak * 100)}%` }"
      />
    </div>

    <span class="shrink-0 text-xs tabular-nums text-muted">{{ clock }}</span>
  </div>
</template>
