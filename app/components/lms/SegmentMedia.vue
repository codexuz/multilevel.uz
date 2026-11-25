<script setup lang="ts">
/**
 * A dictation's recording: an uploaded audio or video file, or a YouTube video. It plays one timed
 * segment at a time (from its start, pausing at its end) at the speed asked; with `controls` it is
 * a normal player too (the teacher marks segment times on it).
 */
const props = defineProps<{ src?: string | null, youtubeUrl?: string | null, audioOnly?: boolean, controls?: boolean }>()
const emit = defineEmits<{ ended: [] }>()

const ytId = computed(() => youtubeId(props.youtubeUrl))
const isVideo = computed(() => !ytId.value && isVideoFile(props.src))
const el = ref<HTMLMediaElement | null>(null)
const host = ref<HTMLElement | null>(null)
const playing = ref(false)
const now = ref(0)

interface YtPlayer { seekTo: (s: number, a: boolean) => void, playVideo: () => void, pauseVideo: () => void, getCurrentTime: () => number, setPlaybackRate: (r: number) => void, destroy: () => void }
let yt: YtPlayer | null = null
// The YouTube player's methods exist only once it is ready.
let ytOk = false
let ytReady: Promise<void> | null = null
let stopAt: number | null = null
let poll: ReturnType<typeof setInterval> | null = null

function loadYtApi(): Promise<any> {
  const w = window as any
  if (w.YT?.Player) return Promise.resolve(w.YT)
  return new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(w.YT)
    }
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.dataset.ytApi = '1'
      document.head.appendChild(s)
    }
  })
}
function setupYt() {
  if (!ytId.value || !host.value) return
  ytReady = new Promise((resolve) => {
    loadYtApi().then((YT) => {
      yt = new YT.Player(host.value, {
        videoId: ytId.value,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: { controls: props.controls ? 1 : 0, disablekb: props.controls ? 0 : 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, cc_load_policy: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            ytOk = true
            resolve()
          },
          onStateChange: (e: { data: number }) => (playing.value = e.data === 1)
        }
      })
    })
  })
}

/** The position now, in seconds (to mark a segment's start or end). */
function currentTime() {
  if (ytId.value) return yt && ytOk ? yt.getCurrentTime() : 0
  return el.value?.currentTime ?? 0
}
function stop() {
  stopAt = null
  if (yt && ytOk) yt.pauseVideo()
  else el.value?.pause()
}
/** Plays from `start` and pauses at `end`, at `rate`. */
async function play(start: number, end: number, rate = 1) {
  stopAt = end
  if (ytId.value) {
    await ytReady
    if (!yt || !ytOk) return
    yt.setPlaybackRate(rate)
    yt.seekTo(start, true)
    yt.playVideo()
    return
  }
  const m = el.value
  if (!m) return
  m.playbackRate = rate
  m.currentTime = start
  await m.play().catch(() => {})
}
function tick() {
  now.value = currentTime()
  if (stopAt != null && now.value >= stopAt - 0.05) {
    stop()
    emit('ended')
  }
}

onMounted(() => {
  if (ytId.value) setupYt()
  poll = setInterval(tick, 50)
})
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
  yt?.destroy()
})
watch(ytId, () => {
  yt?.destroy()
  yt = null
  ytOk = false
  nextTick(setupYt)
})
defineExpose({ play, stop, currentTime, playing, now })
</script>

<template>
  <div class="w-full">
    <div
      v-if="ytId"
      class="aspect-video w-full rounded-lg overflow-hidden bg-black"
      :class="controls ? '' : 'pointer-events-none'"
    >
      <div
        ref="host"
        class="size-full"
      />
    </div>
    <video
      v-else-if="isVideo"
      ref="el"
      :src="mediaUrl(src)"
      :controls="controls"
      playsinline
      preload="metadata"
      class="w-full rounded-lg bg-black"
      :class="audioOnly && !controls ? 'hidden' : 'max-h-80'"
      @play="playing = true"
      @pause="playing = false"
    />
    <audio
      v-else-if="src"
      ref="el"
      :src="mediaUrl(src)"
      :controls="controls"
      preload="metadata"
      class="w-full"
      :class="controls ? '' : 'hidden'"
      @play="playing = true"
      @pause="playing = false"
    />
  </div>
</template>
