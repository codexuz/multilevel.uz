<script setup lang="ts">
import type { Cue } from '~/utils/review'

const { t } = useI18n()

/**
 * The recording with its transcript. A timed transcript (WebVTT or SRT) follows the audio and a
 * line can be clicked to hear it; a plain text one is shown as it is; a PDF or Word file opens
 * in a new tab.
 */
const props = defineProps<{ audioUrl?: string | null, transcriptUrl?: string | null, title?: string | null }>()

const audio = ref<HTMLAudioElement>()
const scroller = ref<HTMLElement>()
const cues = ref<Cue[]>([])
const text = ref('')
const loading = ref(false)
const failed = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playing = ref(false)
let userScrolling = false
let userTimer: ReturnType<typeof setTimeout> | undefined

/** Whether the file turned out to be text this panel can show; a document otherwise. */
const readable = ref(true)

watch(() => props.transcriptUrl, async (url) => {
  cues.value = []
  text.value = ''
  failed.value = false
  readable.value = true
  if (!url) return
  loading.value = true
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    readable.value = readableTranscript(res.headers.get('content-type'), res.headers.get('content-disposition'))
    if (!readable.value) {
      res.body?.cancel().catch(() => {})
      return
    }
    const raw = await res.text()
    cues.value = parseCues(raw)
    if (!cues.value.length) text.value = raw.trim()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}, { immediate: true })

watch(() => props.audioUrl, () => {
  playing.value = false
  currentTime.value = 0
})

const activeIndex = computed(() => cues.value.findIndex(c => currentTime.value >= c.start && currentTime.value < c.end))

watch(activeIndex, (i) => {
  if (userScrolling || i < 0) return
  nextTick(() => scroller.value?.querySelector(`[data-cue="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
})

function markUserScroll() {
  userScrolling = true
  clearTimeout(userTimer)
  userTimer = setTimeout(() => (userScrolling = false), 5000)
}
onBeforeUnmount(() => clearTimeout(userTimer))

function toggle() {
  if (!audio.value) return
  if (playing.value) audio.value.pause()
  else audio.value.play().catch(() => {})
}

function seek(t?: number) {
  if (!audio.value || t == null) return
  audio.value.currentTime = t
  currentTime.value = t
}

function playFrom(t: number) {
  seek(t)
  audio.value?.play().catch(() => {})
}

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
</script>

<template>
  <div class="h-full flex flex-col">
    <audio
      v-if="audioUrl"
      ref="audio"
      :src="audioUrl"
      preload="metadata"
      class="hidden"
      @timeupdate="currentTime = audio?.currentTime || 0"
      @loadedmetadata="duration = audio?.duration || 0"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
    />
    <div
      v-if="audioUrl"
      class="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-default bg-muted"
    >
      <UButton
        :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
        :aria-label="playing ? t('review.pause') : t('review.play')"
        variant="ghost"
        size="sm"
        square
        @click="toggle"
      />
      <UButton
        icon="i-lucide-rotate-ccw"
        :aria-label="t('review.toStart')"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        @click="seek(0)"
      />
      <USlider
        :model-value="currentTime"
        :max="duration || 1"
        :step="0.1"
        size="sm"
        class="flex-1"
        @update:model-value="seek"
      />
      <span class="text-xs text-muted tabular-nums shrink-0">{{ fmt(currentTime) }} / {{ fmt(duration) }}</span>
    </div>

    <div
      ref="scroller"
      class="flex-1 overflow-y-auto px-4 md:px-5 py-4"
      @wheel.passive="markUserScroll"
      @touchmove.passive="markUserScroll"
    >
      <p
        v-if="title"
        class="font-semibold mb-3"
      >
        {{ title }}
      </p>
      <div class="flex items-center gap-2 mb-3">
        <UBadge
          :label="t('review.transcript')"
          color="secondary"
          variant="subtle"
          size="sm"
        />
        <UButton
          v-if="transcriptUrl"
          :to="transcriptUrl"
          target="_blank"
          :label="t('review.openFile')"
          icon="i-lucide-external-link"
          size="xs"
          color="neutral"
          variant="link"
        />
      </div>

      <div
        v-if="loading"
        class="flex items-center gap-2 py-4 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="animate-spin"
        /> Loading the transcript…
      </div>
      <UEmpty
        v-else-if="!transcriptUrl"
        icon="i-lucide-file-x"
        :title="t('review.noTranscript')"
        variant="naked"
        size="sm"
      />
      <UEmpty
        v-else-if="!readable || failed"
        icon="i-lucide-file-text"
        :title="failed ? t('review.transcriptFailed') : t('review.transcriptDoc')"
        :description="t('review.transcriptOpen')"
        variant="naked"
        size="sm"
        :actions="[{ label: t('review.openTranscript'), icon: 'i-lucide-external-link', to: transcriptUrl, target: '_blank', color: 'neutral', variant: 'outline' }]"
      />
      <p
        v-else-if="text"
        class="text-sm leading-7 whitespace-pre-wrap"
      >
        {{ text }}
      </p>

      <button
        v-for="(cue, idx) in cues"
        :key="idx"
        type="button"
        :data-cue="idx"
        class="w-full flex items-start gap-3 text-left rounded-md px-2 py-1.5 hover:bg-elevated/60"
        @click="playFrom(cue.start)"
      >
        <span
          class="font-mono text-[10px] min-w-10 mt-1 shrink-0"
          :class="idx === activeIndex ? 'text-primary' : 'text-dimmed'"
        >{{ fmt(cue.start) }}</span>
        <span
          class="text-sm leading-relaxed rounded-sm transition-colors duration-300"
          :class="idx === activeIndex ? 'bg-yellow-200 dark:bg-yellow-800/60 font-semibold px-1 text-highlighted' : activeIndex >= 0 && idx < activeIndex ? 'text-muted' : 'text-default'"
        >{{ cue.text }}</span>
      </button>
    </div>
  </div>
</template>
