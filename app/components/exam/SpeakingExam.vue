<script setup lang="ts">
import type { SpeakingPart } from '~/types/ielts'

/**
 * Sitting Multilevel Speaking on screen, part by part: the questions or card (and picture), the
 * preparation time, then a recording up to the part's speaking time. Each answer can be heard back
 * and recorded again before moving on. The recordings stay in the browser until handed in.
 */
export interface SpeakingRecording { partId: string, blob: Blob, url: string, durationSeconds: number }

const props = defineProps<{ parts: (SpeakingPart & { imageUrl?: string | null })[], leaveTo?: string }>()
const emit = defineEmits<{ submit: [recordings: SpeakingRecording[]] }>()

const index = ref(0)
const part = computed(() => props.parts[index.value])
const isLast = computed(() => index.value >= props.parts.length - 1)
const recordings = ref<Record<string, SpeakingRecording>>({})
const recorder = useRecorder()

/** Preparation, then speaking: the part's own times, or the Multilevel defaults. */
const prepSeconds = computed(() => part.value?.prepSeconds ?? (part.value?.partNumber === 3 || part.value?.partNumber === 4 ? 60 : 5))
const speakSeconds = computed(() => part.value?.speakSeconds ?? (part.value?.partNumber === 3 || part.value?.partNumber === 4 ? 120 : 30))
const phase = ref<'ready' | 'preparing' | 'recording' | 'done'>('ready')
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function tick(seconds: number, then: () => void) {
  clearInterval(timer)
  countdown.value = seconds
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      then()
    }
  }, 1000)
}

function prepare() {
  phase.value = 'preparing'
  tick(prepSeconds.value, record)
}

async function record() {
  clearInterval(timer)
  await recorder.start()
  if (recorder.error.value) {
    phase.value = 'ready'
    return
  }
  phase.value = 'recording'
  tick(speakSeconds.value, stop)
}

function stop() {
  clearInterval(timer)
  recorder.stop()
}

// A finished take is kept for this part, with its own address to play it back.
watch(() => recorder.blob.value, (blob) => {
  if (!blob || !part.value) return
  const old = recordings.value[part.value.id]
  if (old) URL.revokeObjectURL(old.url)
  recordings.value = { ...recordings.value, [part.value.id]: { partId: part.value.id, blob, url: URL.createObjectURL(blob), durationSeconds: recorder.elapsed.value } }
  recorder.reset()
  phase.value = 'done'
})

function again() {
  phase.value = 'ready'
}

function next() {
  if (isLast.value) return emit('submit', Object.values(recordings.value))
  index.value++
  phase.value = recordings.value[props.parts[index.value]!.id] ? 'done' : 'ready'
}

function back() {
  if (index.value === 0) return
  index.value--
  phase.value = recordings.value[props.parts[index.value]!.id] ? 'done' : 'ready'
}

onBeforeUnmount(() => clearInterval(timer))
const mmss = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`
</script>

<template>
  <div class="h-full min-h-0 flex flex-col">
    <div class="flex items-center justify-between gap-3 px-4 py-2 border-b border-default shrink-0">
      <UButton
        :to="leaveTo"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        label="Leave"
      />
      <div class="flex items-center gap-1.5">
        <UBadge
          v-for="(p, i) in parts"
          :key="p.id"
          :label="speakingPartLabel(p.partNumber)"
          :color="i === index ? 'primary' : recordings[p.id] ? 'success' : 'neutral'"
          :variant="i === index ? 'solid' : 'soft'"
        />
      </div>
      <span class="text-sm text-muted tabular-nums">{{ Object.keys(recordings).length }} / {{ parts.length }} recorded</span>
    </div>

    <div
      v-if="part"
      class="flex-1 min-h-0 overflow-y-auto"
    >
      <div class="max-w-3xl mx-auto p-6 flex flex-col gap-5">
        <div>
          <p class="text-sm font-medium text-primary">
            {{ speakingPartLabel(part.partNumber) }}
          </p>
          <h2 class="text-xl font-semibold text-highlighted">
            {{ (part.title || '').replace(/^Part [\d.]+\s*[—-]\s*/, '') || speakingPartLabel(part.partNumber) }}
          </h2>
        </div>
        <img
          v-if="part.imageUrl"
          :src="part.imageUrl"
          alt=""
          class="rounded-lg max-h-80 object-contain self-start border border-default"
        >
        <div
          v-if="part.cueCard"
          class="rich-content rounded-lg border border-default p-4 bg-elevated/40"
          v-html="part.cueCard"
        />
        <ol
          v-if="part.questions?.length"
          class="list-decimal pl-5 flex flex-col gap-1.5 text-highlighted"
        >
          <li
            v-for="q in part.questions"
            :key="q.id"
          >
            {{ q.text }}
          </li>
        </ol>

        <UAlert
          v-if="recorder.error.value"
          color="error"
          variant="subtle"
          icon="i-lucide-mic-off"
          title="The microphone is not available"
          :description="`${recorder.error.value}. Allow microphone access in the browser and try again.`"
        />

        <UCard>
          <div
            v-if="phase === 'ready'"
            class="flex flex-wrap items-center justify-between gap-3"
          >
            <p class="text-sm text-muted">
              {{ prepSeconds }} s to prepare, then up to {{ speakSeconds }} s to speak.
            </p>
            <div class="flex gap-2">
              <UButton
                label="Start"
                icon="i-lucide-play"
                @click="prepare"
              />
              <UButton
                label="Speak now"
                icon="i-lucide-mic"
                color="neutral"
                variant="outline"
                @click="record"
              />
            </div>
          </div>
          <div
            v-else-if="phase === 'preparing'"
            class="flex flex-wrap items-center justify-between gap-3"
          >
            <p class="font-medium">
              Prepare your answer <span class="tabular-nums text-primary">{{ mmss(countdown) }}</span>
            </p>
            <UButton
              label="Speak now"
              icon="i-lucide-mic"
              @click="record"
            />
          </div>
          <div
            v-else-if="phase === 'recording'"
            class="flex flex-wrap items-center justify-between gap-3"
          >
            <p class="font-medium flex items-center gap-2">
              <span class="size-2.5 rounded-full bg-error animate-pulse" /> Recording <span class="tabular-nums">{{ mmss(countdown) }}</span> left
            </p>
            <UButton
              label="Stop"
              icon="i-lucide-square"
              color="error"
              @click="stop"
            />
          </div>
          <div
            v-else
            class="flex flex-col gap-3"
          >
            <audio
              v-if="recordings[part.id]"
              :src="recordings[part.id]!.url"
              controls
              class="w-full"
            />
            <div class="flex flex-wrap gap-2">
              <UButton
                label="Record again"
                icon="i-lucide-rotate-ccw"
                color="neutral"
                variant="outline"
                @click="again"
              />
            </div>
          </div>
        </UCard>

        <div class="flex justify-between gap-2">
          <UButton
            label="Previous part"
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            :disabled="index === 0 || phase === 'recording'"
            @click="back"
          />
          <UButton
            :label="isLast ? 'Finish' : 'Next part'"
            :trailing-icon="isLast ? 'i-lucide-check' : 'i-lucide-chevron-right'"
            :disabled="phase === 'recording' || phase === 'preparing' || (isLast && !Object.keys(recordings).length)"
            @click="next"
          />
        </div>
      </div>
    </div>
  </div>
</template>
