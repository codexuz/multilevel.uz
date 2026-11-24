<script setup lang="ts">
/**
 * A video player with Mockmee's own controls instead of the browser's or YouTube's: a cover with a
 * big play button, then a bar with play/pause, back and forward 10 seconds, a seek bar (what is
 * loaded, what is played), the time, the speed (0.75× to 2×), the sound and full screen. The
 * controls fade while the video plays and come back on a move or a tap.
 *
 * YouTube videos play through YouTube's IFrame API with its controls hidden; video files (MP4,
 * WebM…) in a bare <video>; Vimeo, which allows neither here, in its own embedded player.
 * Keyboard (on the player): Space or K plays, arrows move 5 seconds and set the volume, F is full
 * screen, M is mute. One player plays at a time.
 */
interface YtPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (s: number, allow: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getVideoLoadedFraction: () => number
  setVolume: (v: number) => void
  mute: () => void
  unMute: () => void
  setPlaybackRate: (r: number) => void
  destroy: () => void
}
type YtNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YtPlayer, PlayerState: Record<string, number> }

const props = withDefaults(defineProps<{ src: string, title?: string | null, poster?: string | null }>(), { title: null, poster: null })
const { t } = useI18n()

const ytId = computed(() => youtubeId(props.src))
const fileSrc = computed(() => (!ytId.value && isVideoFile(props.src) ? props.src : null))
const embed = computed(() => (!ytId.value && !fileSrc.value ? videoEmbed(props.src) : null))
const cover = computed(() => props.poster || (ytId.value ? `https://i.ytimg.com/vi/${ytId.value}/hqdefault.jpg` : null))

const root = ref<HTMLElement>()
const host = ref<HTMLElement>()
const video = ref<HTMLVideoElement>()
const started = ref(false)
const ready = ref(false)
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const buffered = ref(0)
const volume = ref(100)
const muted = ref(false)
const rate = ref(1)
const full = ref(false)
const shown = ref(true)
const RATES = [1, 1.25, 1.5, 2, 0.75]
const id = Math.random().toString(36).slice(2)

// ---- YouTube: its IFrame API, loaded once for the page ----
let yt: YtPlayer | null = null
let poll: ReturnType<typeof setInterval> | null = null
let ytApi: Promise<YtNamespace> | null = null
function loadYt(): Promise<YtNamespace> {
  const w = window as unknown as { YT?: YtNamespace & { loaded?: number }, onYouTubeIframeAPIReady?: () => void }
  if (w.YT?.Player) return Promise.resolve(w.YT)
  ytApi ??= new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(w.YT!)
    }
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.dataset.ytApi = '1'
      document.head.appendChild(s)
    }
  })
  return ytApi
}
async function startYt() {
  const YT = await loadYt()
  if (!host.value) return
  yt = new YT.Player(host.value, {
    videoId: ytId.value,
    host: 'https://www.youtube-nocookie.com',
    width: '100%',
    height: '100%',
    playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: () => {
        ready.value = true
        duration.value = yt!.getDuration()
        yt!.setVolume(volume.value)
        yt!.playVideo()
      },
      onStateChange: (e: { data: number }) => {
        // 1 playing, 2 paused, 0 ended, 3 buffering
        playing.value = e.data === 1 || e.data === 3
        if (e.data === 1) announce()
        if (e.data === 0) {
          playing.value = false
          shown.value = true
        }
      }
    }
  })
  poll = setInterval(() => {
    if (!yt || !ready.value) return
    current.value = yt.getCurrentTime()
    duration.value = yt.getDuration() || duration.value
    buffered.value = yt.getVideoLoadedFraction()
  }, 250)
}

// ---- actions, for either kind ----
function announce() {
  window.dispatchEvent(new CustomEvent(MEDIA_PLAY_EVENT, { detail: id }))
}
function onOtherPlay(e: Event) {
  if ((e as CustomEvent<string>).detail !== id && playing.value) pause()
}
async function start() {
  started.value = true
  if (ytId.value) {
    await nextTick()
    await startYt()
  } else {
    await nextTick()
    play()
  }
}
function play() {
  if (!started.value) return start()
  announce()
  if (yt) yt.playVideo()
  else video.value?.play().catch(() => {})
}
function pause() {
  if (yt) yt.pauseVideo()
  else video.value?.pause()
}
const toggle = () => (playing.value ? pause() : play())
function seekTo(s: number) {
  const to = Math.min(duration.value || 0, Math.max(0, s))
  current.value = to
  if (yt) yt.seekTo(to, true)
  else if (video.value) video.value.currentTime = to
}
function setVolume(v: number) {
  volume.value = Math.min(100, Math.max(0, Math.round(v)))
  muted.value = volume.value === 0
  if (yt) {
    yt.setVolume(volume.value)
    if (muted.value) yt.mute()
    else yt.unMute()
  } else if (video.value) {
    video.value.volume = volume.value / 100
    video.value.muted = muted.value
  }
}
function toggleMute() {
  muted.value = !muted.value
  if (yt) {
    if (muted.value) yt.mute()
    else yt.unMute()
  } else if (video.value) video.value.muted = muted.value
}
function cycleRate() {
  rate.value = RATES[(RATES.indexOf(rate.value) + 1) % RATES.length]!
  if (yt) yt.setPlaybackRate(rate.value)
  else if (video.value) video.value.playbackRate = rate.value
}
async function toggleFull() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else if (root.value?.requestFullscreen) await root.value.requestFullscreen()
  else (video.value as HTMLVideoElement & { webkitEnterFullscreen?: () => void } | undefined)?.webkitEnterFullscreen?.()
}

// ---- the seek bar: tap or drag ----
const bar = ref<HTMLElement>()
let dragging = false
const ratioAt = (e: PointerEvent) => {
  const r = bar.value!.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
}
function barDown(e: PointerEvent) {
  if (!duration.value) return
  dragging = true
  bar.value?.setPointerCapture(e.pointerId)
  seekTo(ratioAt(e) * duration.value)
}
function barMove(e: PointerEvent) {
  if (dragging) seekTo(ratioAt(e) * duration.value)
}
function barUp(e: PointerEvent) {
  dragging = false
  bar.value?.releasePointerCapture(e.pointerId)
}

// ---- controls that fade while playing ----
let hideTimer: ReturnType<typeof setTimeout> | null = null
function wake() {
  shown.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (playing.value && !dragging) shown.value = false
  }, 2500)
}
watch(playing, (p) => {
  if (p) wake()
  else shown.value = true
})

function key(e: KeyboardEvent) {
  if (!started.value && (e.key === ' ' || e.key === 'Enter')) return (e.preventDefault(), start())
  const k = e.key.toLowerCase()
  if (k === ' ' || k === 'k') toggle()
  else if (k === 'arrowright') seekTo(current.value + 5)
  else if (k === 'arrowleft') seekTo(current.value - 5)
  else if (k === 'arrowup') setVolume(volume.value + 10)
  else if (k === 'arrowdown') setVolume(volume.value - 10)
  else if (k === 'f') toggleFull()
  else if (k === 'm') toggleMute()
  else return
  e.preventDefault()
  wake()
}

function onFullChange() {
  full.value = document.fullscreenElement === root.value
}
onMounted(() => {
  window.addEventListener(MEDIA_PLAY_EVENT, onOtherPlay)
  document.addEventListener('fullscreenchange', onFullChange)
})
onBeforeUnmount(() => {
  window.removeEventListener(MEDIA_PLAY_EVENT, onOtherPlay)
  document.removeEventListener('fullscreenchange', onFullChange)
  if (poll) clearInterval(poll)
  if (hideTimer) clearTimeout(hideTimer)
  yt?.destroy()
})

function onMeta(e: Event) {
  duration.value = (e.target as HTMLVideoElement).duration
  ready.value = true
}
function onProgress(e: Event) {
  const v = e.target as HTMLVideoElement
  buffered.value = v.buffered.length && duration.value ? v.buffered.end(v.buffered.length - 1) / duration.value : 0
}

const played = computed(() => (duration.value ? current.value / duration.value : 0))
</script>

<template>
  <!-- Vimeo and other embeddable players keep their own controls. -->
  <div
    v-if="embed"
    class="aspect-video w-full overflow-hidden rounded-xl ring ring-default bg-black"
  >
    <iframe
      :src="embed"
      class="size-full"
      :title="title ?? ''"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
      loading="lazy"
    />
  </div>
  <UButton
    v-else-if="!ytId && !fileSrc"
    :href="src"
    target="_blank"
    rel="noopener"
    :label="t('courses.watchVideo')"
    icon="i-lucide-play-circle"
    color="neutral"
    variant="outline"
    class="self-start"
  />
  <div
    v-else
    ref="root"
    class="group/player relative aspect-video w-full overflow-hidden rounded-xl bg-black text-white select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="[full ? 'rounded-none' : 'ring ring-default', playing && !shown ? 'cursor-none' : '']"
    tabindex="0"
    role="region"
    :aria-label="title ? t('media.videoNamed', { title }) : t('media.video')"
    data-testid="video-player"
    @keydown="key"
    @pointermove="wake"
  >
    <!-- The picture -->
    <div
      v-if="ytId && started"
      class="absolute inset-0 [&>iframe]:size-full pointer-events-none"
    >
      <div ref="host" />
    </div>
    <video
      v-if="fileSrc"
      ref="video"
      :src="fileSrc"
      :poster="cover ?? undefined"
      playsinline
      preload="metadata"
      class="absolute inset-0 size-full object-contain"
      @loadedmetadata="onMeta"
      @timeupdate="current = ($event.target as HTMLVideoElement).currentTime"
      @progress="onProgress"
      @play="playing = true; announce()"
      @pause="playing = false"
      @ended="playing = false"
    />

    <!-- The cover, before the first play -->
    <button
      v-if="!started"
      type="button"
      class="absolute inset-0 grid place-items-center cursor-pointer"
      :aria-label="t('media.play')"
      @click="start"
    >
      <img
        v-if="cover && ytId"
        :src="cover"
        alt=""
        class="absolute inset-0 size-full object-cover"
        loading="lazy"
      >
      <span class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />
      <span class="relative grid place-items-center size-16 sm:size-20 rounded-full bg-primary text-inverted shadow-lg transition-transform duration-200 group-hover/player:scale-105">
        <UIcon
          name="i-lucide-play"
          class="size-7 sm:size-8 translate-x-0.5"
        />
      </span>
      <span
        v-if="title"
        class="absolute top-0 inset-x-0 p-4 text-start text-sm sm:text-base font-semibold line-clamp-2 drop-shadow"
      >{{ title }}</span>
    </button>

    <!-- A tap on the picture plays or pauses (and stops YouTube's own clicks) -->
    <div
      v-else
      class="absolute inset-0"
      @click="toggle(); wake()"
      @dblclick="toggleFull"
    />

    <!-- Waiting for YouTube to start -->
    <div
      v-if="started && ytId && !ready"
      class="absolute inset-0 grid place-items-center pointer-events-none"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-white/80"
      />
    </div>

    <!-- The controls -->
    <div
      v-if="started"
      class="absolute inset-x-0 bottom-0 px-3 sm:px-4 pb-2 sm:pb-3 pt-10 bg-gradient-to-t from-black/75 via-black/35 to-transparent transition-opacity duration-200"
      :class="shown ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      @click.stop
    >
      <div
        ref="bar"
        class="group/bar relative h-4 flex items-center cursor-pointer touch-none"
        role="slider"
        :aria-label="t('media.position')"
        :aria-valuemin="0"
        :aria-valuemax="Math.round(duration)"
        :aria-valuenow="Math.round(current)"
        :aria-valuetext="`${clockTime(current)} / ${clockTime(duration)}`"
        @pointerdown="barDown"
        @pointermove="barMove"
        @pointerup="barUp"
        @pointercancel="barUp"
      >
        <div class="relative w-full h-1 group-hover/bar:h-1.5 rounded-full bg-white/25 overflow-hidden transition-[height]">
          <div
            class="absolute inset-y-0 left-0 bg-white/35"
            :style="{ width: `${buffered * 100}%` }"
          />
          <div
            class="absolute inset-y-0 left-0 bg-primary"
            :style="{ width: `${played * 100}%` }"
          />
        </div>
        <div
          class="absolute size-3.5 -ms-[7px] rounded-full bg-white shadow scale-0 group-hover/bar:scale-100 transition-transform"
          :style="{ left: `${played * 100}%` }"
        />
      </div>

      <div class="flex items-center gap-1 sm:gap-2 mt-1">
        <button
          type="button"
          class="grid place-items-center size-9 rounded-full hover:bg-white/15"
          :aria-label="playing ? t('media.pause') : t('media.play')"
          @click="toggle"
        >
          <UIcon
            :name="playing ? 'i-lucide-pause' : 'i-lucide-play'"
            class="size-5"
          />
        </button>
        <button
          type="button"
          class="grid place-items-center size-9 rounded-full hover:bg-white/15"
          :aria-label="t('media.back10')"
          @click="seekTo(current - 10)"
        >
          <UIcon
            name="i-lucide-rotate-ccw"
            class="size-4.5"
          />
        </button>
        <button
          type="button"
          class="grid place-items-center size-9 rounded-full hover:bg-white/15"
          :aria-label="t('media.forward10')"
          @click="seekTo(current + 10)"
        >
          <UIcon
            name="i-lucide-rotate-cw"
            class="size-4.5"
          />
        </button>
        <span class="text-xs sm:text-sm tabular-nums text-white/90 ms-1">{{ clockTime(current) }} / {{ clockTime(duration) }}</span>

        <div class="ms-auto flex items-center gap-1">
          <button
            type="button"
            class="h-7 min-w-11 px-2 rounded-full text-xs font-semibold hover:bg-white/15 ring ring-white/30"
            :aria-label="t('media.speed', { rate })"
            @click="cycleRate"
          >
            {{ rate }}×
          </button>
          <div class="hidden sm:flex items-center group/vol">
            <button
              type="button"
              class="grid place-items-center size-9 rounded-full hover:bg-white/15"
              :aria-label="muted ? t('media.unmute') : t('media.mute')"
              @click="toggleMute"
            >
              <UIcon
                :name="muted || volume === 0 ? 'i-lucide-volume-x' : volume < 50 ? 'i-lucide-volume-1' : 'i-lucide-volume-2'"
                class="size-5"
              />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              :value="muted ? 0 : volume"
              :aria-label="t('media.volume')"
              class="w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100 transition-[width,opacity] duration-200 accent-[var(--ui-primary)] cursor-pointer"
              @input="setVolume(Number(($event.target as HTMLInputElement).value))"
            >
          </div>
          <button
            type="button"
            class="grid place-items-center size-9 rounded-full hover:bg-white/15"
            :aria-label="full ? t('media.exitFull') : t('media.full')"
            @click="toggleFull"
          >
            <UIcon
              :name="full ? 'i-lucide-minimize' : 'i-lucide-maximize'"
              class="size-5"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
