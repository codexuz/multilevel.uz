<script setup lang="ts">
import type { SpeakingPart } from '~/types/ielts'
import type { SpeakingStep } from '~~/shared/utils/speaking'

const { t } = useI18n()

/**
 * Sitting Speaking (Multilevel or IELTS) the way the exam runs it, with no buttons to press between turns:
 * a microphone check, then for each part a short introduction, and for each turn the examiner
 * reading the question aloud, the time to prepare, a beep and the recording, straight on to the
 * next. Part 1.1 and 1.2 are answered question by question, Part 2 and Part 3 in one long turn.
 * There is no going back and no second take, as in the exam; "Start now" and "Finish answer"
 * only cut a wait short.
 *
 * Each answer is its own recording. When `upload` is given (a signed-in candidate), it is sent to
 * storage while the exam goes on, so handing in does not wait for the uploads.
 */
export interface SpeakingRecording {
  partId: string
  position: number
  blob: Blob
  url: string
  durationSeconds: number
  /** The stored file, once uploaded (or the upload under way). */
  audioRef?: Promise<string | null>
}

const props = defineProps<{
  parts: (SpeakingPart & { imageUrl?: string | null })[]
  leaveTo?: string
  upload?: (blob: Blob, step: SpeakingStep) => Promise<string>
}>()
const emit = defineEmits<{ submit: [recordings: SpeakingRecording[]] }>()

const steps = computed(() => speakingSteps(props.parts))
// IELTS: Part 1 (interview) and Part 3 (discussion) question by question, Part 2 the cue card.
const ielts = computed(() => props.parts.some(p => p.exam === 'IELTS'))
const exam = computed(() => (ielts.value ? 'IELTS' : 'MULTILEVEL'))
const partOf = (id: string) => props.parts.find(p => p.id === id)
const turnsIn = (partId: string) => steps.value.filter(s => s.partId === partId).length

// ─── the microphone, open for the whole exam ───
const stream = shallowRef<MediaStream | null>(null)
const micError = ref<string | null>(null)
const mime = () => (typeof MediaRecorder === 'undefined' ? '' : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported(m)) ?? '')

async function openMic() {
  micError.value = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (e) {
    micError.value = (e as Error)?.message || 'Microphone access denied'
  }
}

/** Starts recording on the open microphone; `stop` gives the take. */
function startRecording(s: MediaStream) {
  const type = mime()
  const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined)
  const chunks: BlobPart[] = []
  const began = performance.now()
  rec.ondataavailable = e => e.data.size && chunks.push(e.data)
  rec.start(1000)
  return {
    stop: () => new Promise<{ blob: Blob, seconds: number }>((resolve) => {
      rec.onstop = () => resolve({ blob: new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }), seconds: Math.round((performance.now() - began) / 1000) })
      if (rec.state !== 'inactive') rec.stop()
    })
  }
}

// The input level, for the bars that show the microphone hears you.
const level = ref(0)
let meterCtx: AudioContext | null = null
let meterTimer: ReturnType<typeof setInterval> | undefined
function startMeter(s: MediaStream) {
  try {
    meterCtx = new AudioContext()
    const analyser = meterCtx.createAnalyser()
    analyser.fftSize = 512
    meterCtx.createMediaStreamSource(s).connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    meterTimer = setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) sum += ((v - 128) / 128) ** 2
      level.value = Math.min(1, Math.sqrt(sum / data.length) * 4)
    }, 100)
  } catch {
    // The meter is only a sign of life; the exam goes on without it.
  }
}
function stopMeter() {
  clearInterval(meterTimer)
  meterCtx?.close().catch(() => {})
  meterCtx = null
  level.value = 0
}

// ─── the microphone check ───
const readAloud = ref(true)
const sample = ref<string | null>(null)
const sampling = ref(false)
async function recordSample() {
  if (!stream.value) await openMic()
  if (!stream.value) return
  sampling.value = true
  startMeter(stream.value)
  const take = startRecording(stream.value)
  await new Promise(r => setTimeout(r, 3000))
  const { blob } = await take.stop()
  stopMeter()
  sampling.value = false
  if (sample.value) URL.revokeObjectURL(sample.value)
  sample.value = URL.createObjectURL(blob)
  await nextTick()
  document.querySelector<HTMLAudioElement>('#mic-sample')?.play().catch(() => {})
}

// ─── the examiner ───
let clip: HTMLAudioElement | null = null
let voiceWorks: boolean | null = null
const voiceUrl = (s: SpeakingStep) => `/api/speaking/voice?part=${s.partId}&position=${s.position}`
const plain = (html?: string | null) => (html ?? '').replace(/<table[\s\S]*?<\/table>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const spokenText = (s: SpeakingStep) => s.question ?? (s.partNumber === 4 && !ielts.value ? `${plain(partOf(s.partId)?.cueCard)} Use the arguments for and against.` : plain(partOf(s.partId)?.cueCard))

function playClip(url: string) {
  return new Promise<void>((resolve, reject) => {
    clip = new Audio(url)
    clip.onended = () => resolve()
    clip.onpause = () => resolve()
    clip.onerror = () => reject(new Error('no clip'))
    clip.play().catch(reject)
  })
}
function browserVoice(text: string) {
  return new Promise<void>((resolve) => {
    if (typeof speechSynthesis === 'undefined' || !text) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    u.rate = 0.95
    u.voice = speechSynthesis.getVoices().find(v => v.lang === 'en-GB') ?? null
    u.onend = () => resolve()
    u.onerror = () => resolve()
    speechSynthesis.speak(u)
    // Some browsers never say they finished.
    setTimeout(resolve, Math.max(4000, text.length * 90))
  })
}
/** The test's own audio for the turn: the question's, or the part's for a long turn. */
function ownAudio(s: SpeakingStep) {
  const p = partOf(s.partId)
  if (!p) return null
  return (answeredByQuestion(p.partNumber, p.exam) ? [...p.questions].sort((a, b) => a.position - b.position)[s.position]?.audioUrl : p.audioUrl) ?? null
}
/** The examiner's clip for the turn (the test's own, else the generated one); the browser's voice when there is none. */
async function readOut(s: SpeakingStep) {
  const own = ownAudio(s)
  if (own) {
    try {
      await playClip(own)
      return
    } catch {
      if (cancelled) return
    }
  }
  if (voiceWorks !== false) {
    try {
      await playClip(voiceUrl(s))
      voiceWorks = true
      return
    } catch {
      if (cancelled) return
      voiceWorks = false
    }
  }
  await browserVoice(spokenText(s))
}
function hush() {
  clip?.pause()
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
/** Asks for the next clip early, so it is ready when its turn comes. */
function warm(s?: SpeakingStep) {
  if (s && readAloud.value && (ownAudio(s) || voiceWorks !== false)) new Audio(ownAudio(s) ?? voiceUrl(s)).preload = 'auto'
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => ctx.close()
  } catch {}
}

// ─── the exam ───
type Phase = 'check' | 'intro' | 'listen' | 'prep' | 'rec' | 'done'
const phase = ref<Phase>('check')
const index = ref(0)
const step = computed(() => steps.value[index.value])
const part = computed(() => (step.value ? partOf(step.value.partId) : undefined))
const left = ref(0)
const total = ref(1)
const recordings = ref<SpeakingRecording[]>([])
const uploading = ref(0)
let skip: (() => void) | null = null
let cancelled = false

function countdown(seconds: number) {
  return new Promise<void>((resolve) => {
    const end = performance.now() + seconds * 1000
    total.value = seconds
    const finish = () => {
      clearInterval(timer)
      skip = null
      resolve()
    }
    const tick = () => {
      left.value = Math.max(0, (end - performance.now()) / 1000)
      if (left.value <= 0 || cancelled) finish()
    }
    const timer = setInterval(tick, 200)
    skip = finish
    tick()
  })
}
const waitForReady = () => new Promise<void>(resolve => (skip = () => {
  skip = null
  resolve()
}))

async function run() {
  const s0 = stream.value
  if (!s0) return
  for (let i = 0; i < steps.value.length && !cancelled; i++) {
    const s = steps.value[i]!
    index.value = i
    if (s.first) {
      phase.value = 'intro'
      await waitForReady()
      if (cancelled) return
    }
    // Like the exam: the examiner reads the question, then the preparation starts.
    if (readAloud.value) {
      phase.value = 'listen'
      left.value = s.prepSeconds
      total.value = s.prepSeconds
      skip = hush
      warm(steps.value[i + 1])
      await readOut(s)
      skip = null
      if (cancelled) return
    }
    phase.value = 'prep'
    await countdown(s.prepSeconds)
    if (cancelled) return

    beep()
    phase.value = 'rec'
    startMeter(s0)
    const take = startRecording(s0)
    await countdown(s.speakSeconds)
    const { blob, seconds } = await take.stop()
    stopMeter()
    const rec: SpeakingRecording = { partId: s.partId, position: s.position, blob, url: URL.createObjectURL(blob), durationSeconds: Math.min(seconds, s.speakSeconds) }
    if (props.upload) {
      uploading.value++
      rec.audioRef = props.upload(blob, s).catch(() => null).finally(() => uploading.value--)
    }
    recordings.value = [...recordings.value, rec]
  }
  if (cancelled) return
  phase.value = 'done'
  s0.getTracks().forEach(tr => tr.stop())
  emit('submit', recordings.value)
}

/** The button under the turn: cuts the current wait short (or starts the part). */
function next() {
  skip?.()
}

function begin() {
  if (!stream.value) return
  index.value = 0
  run()
}

onBeforeUnmount(() => {
  cancelled = true
  skip?.()
  hush()
  stopMeter()
  stream.value?.getTracks().forEach(tr => tr.stop())
  if (sample.value) URL.revokeObjectURL(sample.value)
})

// ─── what the screen says ───
const secondsText = (s: number) => (s >= 60 && s % 60 === 0 ? t('speak.minutes', { n: s / 60 }, s / 60) : t('speak.seconds', { n: s }, s))
const PART_NAME = computed(() => (ielts.value
  ? { 1: 'speak.i1', 2: 'speak.i2', 3: 'speak.i3' }
  : { 1: 'speak.p1', 2: 'speak.p2', 3: 'speak.p3', 4: 'speak.p4' }) as Record<number, string>)
const PART_NUMBER = computed(() => (ielts.value ? { 1: '1', 2: '2', 3: '3' } : { 1: '1.1', 2: '1.2', 3: '2', 4: '3' }) as Record<number, string>)
/** Where the card (and a picture) shows: Multilevel Part 1.2's first turn, Part 2 and Part 3; IELTS Part 2. */
const showsCard = (s: SpeakingStep) => (ielts.value ? s.partNumber === 2 : s.partNumber >= 3 || (s.partNumber === 2 && s.position === 0))
const showsImage = (s: SpeakingStep) => (ielts.value ? s.position === 0 : s.partNumber === 3 || (s.partNumber === 2 && s.position === 0))
const partInfo = computed(() => {
  const s = step.value
  if (!s) return ''
  const n = turnsIn(s.partId)
  const next = steps.value[index.value + 1]
  if (ielts.value) {
    if (s.partNumber === 2) return t('speak.i2Info', { prep: secondsText(s.prepSeconds), speak: secondsText(s.speakSeconds) })
    return t(s.partNumber === 3 ? 'speak.i3Info' : 'speak.i1Info', { n, speak: secondsText(s.speakSeconds) })
  }
  if (s.partNumber === 1) return t('speak.p1Info', { n, prep: secondsText(s.prepSeconds), speak: secondsText(s.speakSeconds) })
  if (s.partNumber === 2) return t('speak.p2Info', { speak: secondsText(s.speakSeconds), n: n - 1, then: secondsText(next?.partId === s.partId ? next.speakSeconds : 30) })
  return t(s.partNumber === 4 ? 'speak.p4Info' : 'speak.p3Info', { prep: secondsText(s.prepSeconds), speak: secondsText(s.speakSeconds) })
})
const clock = computed(() => {
  const s = Math.ceil(left.value)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
const ring = computed(() => 326.7 * (1 - left.value / (total.value || 1)))
const button = computed(() => ({ intro: t('speak.ready'), listen: t('speak.skipListening'), prep: t('speak.startNow'), rec: t('speak.finishAnswer') } as Record<string, string>)[phase.value] ?? '')
</script>

<template>
  <div class="h-full min-h-0 flex flex-col bg-default">
    <!-- Where you are -->
    <div class="shrink-0 border-b border-default">
      <div class="flex items-center justify-between gap-3 px-4 py-2">
        <UButton
          :to="leaveTo"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          :label="t('exam.leave')"
        />
        <div class="flex items-center gap-1.5">
          <UBadge
            v-for="p in parts"
            :key="p.id"
            :label="speakingPartLabel(p.partNumber, exam)"
            :color="step?.partId === p.id && phase !== 'check' ? 'primary' : recordings.some(r => r.partId === p.id) ? 'success' : 'neutral'"
            :variant="step?.partId === p.id && phase !== 'check' ? 'solid' : 'soft'"
          />
        </div>
        <span class="text-sm text-muted tabular-nums max-sm:hidden">
          <template v-if="phase !== 'check'">{{ t('speak.qOf', { n: Math.min(index + 1, steps.length), total: steps.length }) }}</template>
        </span>
      </div>
      <UProgress
        v-if="phase !== 'check'"
        :model-value="(recordings.length / (steps.length || 1)) * 100"
        size="2xs"
      />
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <!-- The microphone check -->
        <div
          v-if="phase === 'check'"
          class="flex flex-col items-center text-center gap-5"
        >
          <div class="size-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <UIcon
              name="i-lucide-mic"
              class="size-8"
            />
          </div>
          <div>
            <h1 class="text-2xl font-bold text-highlighted">
              {{ t('speak.checkTitle') }}
            </h1>
            <p class="text-muted mt-1 text-pretty">
              {{ t('speak.checkText') }}
            </p>
          </div>
          <UAlert
            v-if="micError"
            color="error"
            variant="subtle"
            icon="i-lucide-mic-off"
            :title="t('speak.micDenied')"
            :description="t('speak.micDeniedText')"
            class="text-start"
          />
          <div class="flex items-end gap-1 h-8">
            <span
              v-for="i in 12"
              :key="i"
              class="w-1.5 rounded-full transition-all duration-100"
              :class="sampling && level * 12 >= i ? 'bg-primary' : 'bg-accented'"
              :style="{ height: `${8 + (i % 4) * 6}px` }"
            />
          </div>
          <audio
            v-if="sample"
            id="mic-sample"
            :src="sample"
            controls
            class="w-full max-w-sm"
          />
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              :label="sampling ? t('speak.testing') : sample ? t('speak.testAgain') : t('speak.testRecord')"
              icon="i-lucide-mic"
              :loading="sampling"
              color="neutral"
              variant="outline"
              size="lg"
              @click="recordSample"
            />
            <UButton
              :label="t('speak.sounds')"
              trailing-icon="i-lucide-arrow-right"
              size="lg"
              :disabled="!stream || sampling"
              @click="begin"
            />
          </div>
          <USwitch
            v-model="readAloud"
            :label="t('speak.readAloud')"
          />
        </div>

        <!-- A part begins -->
        <div
          v-else-if="phase === 'intro' && step"
          class="flex flex-col items-center text-center gap-4 py-8"
        >
          <div class="size-20 rounded-3xl bg-linear-to-br from-primary-400 to-primary-600 text-white text-3xl font-extrabold grid place-items-center shadow-lg shadow-primary-500/25">
            {{ PART_NUMBER[step.partNumber] }}
          </div>
          <h1 class="text-3xl font-bold text-highlighted">
            {{ t(PART_NAME[step.partNumber] ?? 'speak.p1') }}
          </h1>
          <p class="text-lg text-muted text-pretty max-w-lg">
            {{ partInfo }}
          </p>
        </div>

        <!-- A turn -->
        <template v-else-if="step && phase !== 'done'">
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">
            {{ speakingPartLabel(step.partNumber, exam) }} · {{ t(PART_NAME[step.partNumber] ?? 'speak.p1') }}
          </p>
          <img
            v-if="part?.imageUrl && showsImage(step)"
            :src="part.imageUrl"
            alt=""
            class="rounded-xl max-h-72 w-full object-contain ring ring-default bg-elevated"
          >
          <div
            v-if="part?.cueCard && showsCard(step)"
            class="rich-content speaking-card rounded-xl ring ring-default bg-elevated/50 p-5"
            v-html="part.cueCard"
          />
          <p
            v-if="step.question"
            class="text-2xl font-semibold text-highlighted text-balance leading-snug"
          >
            {{ step.question }}
          </p>

          <div class="flex flex-col items-center gap-2 pt-2">
            <div
              class="relative size-40"
              :class="phase === 'rec' ? 'text-error' : 'text-primary'"
            >
              <svg
                viewBox="0 0 120 120"
                class="size-full -rotate-90"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke-width="8"
                  class="stroke-(--ui-border)"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke-width="8"
                  stroke-linecap="round"
                  stroke="currentColor"
                  stroke-dasharray="326.7"
                  :stroke-dashoffset="phase === 'listen' ? 0 : ring"
                  class="transition-[stroke-dashoffset] duration-200"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-xs font-semibold uppercase tracking-wide">
                  <template v-if="phase === 'rec'">
                    <span class="inline-block size-2 rounded-full bg-error animate-pulse me-1 align-middle" />{{ t('speak.speakNow') }}
                  </template>
                  <template v-else-if="phase === 'listen'">{{ t('speak.listen') }}</template>
                  <template v-else>{{ t('speak.prepare') }}</template>
                </span>
                <span
                  v-if="phase !== 'listen'"
                  class="text-3xl font-bold tabular-nums text-highlighted"
                >{{ clock }}</span>
                <UIcon
                  v-else
                  name="i-lucide-volume-2"
                  class="size-8 mt-1 animate-pulse"
                />
              </div>
            </div>
            <div
              v-if="phase === 'rec'"
              class="flex items-end gap-1 h-6"
            >
              <span
                v-for="i in 12"
                :key="i"
                class="w-1.5 rounded-full transition-all duration-100"
                :class="level * 12 >= i ? 'bg-error' : 'bg-accented'"
                :style="{ height: `${6 + (i % 4) * 5}px` }"
              />
            </div>
          </div>
        </template>

        <!-- All answered: handing in -->
        <div
          v-else-if="phase === 'done'"
          class="flex flex-col items-center text-center gap-3 py-12"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-8 text-primary animate-spin"
          />
          <p class="text-muted">
            {{ t('speak.saving') }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="button && phase !== 'check' && phase !== 'done'"
      class="shrink-0 border-t border-default px-4 py-3"
    >
      <div class="max-w-2xl mx-auto flex flex-col items-center gap-1">
        <UButton
          :label="button"
          :color="phase === 'rec' ? 'error' : 'primary'"
          :variant="phase === 'listen' ? 'soft' : 'solid'"
          size="xl"
          block
          class="justify-center"
          @click="next"
        />
        <p class="text-xs text-dimmed h-4">
          {{ uploading ? t('speak.saving') : '' }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.speaking-card :deep(table) {
  width: 100%;
  margin-top: 0.75rem;
  border-collapse: separate;
  border-spacing: 0.5rem 0;
  table-layout: fixed;
}
.speaking-card :deep(th) {
  text-align: start;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
}
.speaking-card :deep(th:first-child) { color: var(--ui-success); }
.speaking-card :deep(th:last-child) { color: var(--ui-error); }
.speaking-card :deep(td) {
  vertical-align: top;
  padding: 0.4rem 0.5rem;
  font-size: 0.9rem;
  border-top: 1px solid var(--ui-border);
}
</style>
