<script setup lang="ts">
import type { StudentQuestionDto } from '~/types/models'

const props = defineProps<{
  questions: StudentQuestionDto[]
  getAudio: (id: string) => string | null | undefined
  submitting?: boolean
}>()
const emit = defineEmits<{
  audio: [id: string, v: string | null]
  save: []
}>()

const rec = useRecorder()
const { upload } = useS3Upload()
const toast = useToast()

// Only speaking prompts, in order.
const items = computed(() =>
  props.questions
    .filter(q => q.type === 'speaking_prompt')
    .sort((a, b) => a.orderIndex - b.orderIndex)
)

type Phase = 'idle' | 'prep' | 'speaking' | 'saving' | 'done'
const index = ref(0)
const phase = ref<Phase>('idle')
const remaining = ref(0)
const total = ref(0)
const current = computed(() => items.value[index.value])

const DEFAULT_PREP = 30
const DEFAULT_SPEAK = 60
const prepTime = computed(() => current.value?.meta?.prepTime ?? DEFAULT_PREP)
const speakTime = computed(() => current.value?.meta?.speakTime ?? DEFAULT_SPEAK)

// Progress ring geometry
const RADIUS = 52
const CIRC = 2 * Math.PI * RADIUS
const dash = computed(() => {
  const frac = total.value ? remaining.value / total.value : 0
  return `${CIRC * frac} ${CIRC}`
})

let ticker: ReturnType<typeof setInterval> | null = null
function countdown(seconds: number, onDone: () => void) {
  total.value = seconds
  remaining.value = seconds
  if (ticker) clearInterval(ticker)
  ticker = setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) {
      if (ticker) clearInterval(ticker)
      ticker = null
      onDone()
    }
  }, 1000)
}

function begin() {
  index.value = 0
  runQuestion()
}

function runQuestion() {
  if (index.value >= items.value.length) {
    phase.value = 'done'
    return
  }
  // Prep phase — prompt + image shown, prep countdown running
  phase.value = 'prep'
  countdown(prepTime.value, startSpeaking)
}

async function startSpeaking() {
  phase.value = 'speaking'
  await rec.start()
  if (rec.error.value) {
    toast.add({ title: 'Mikrofon xatosi', description: rec.error.value, color: 'error' })
    phase.value = 'idle'
    return
  }
  countdown(speakTime.value, stopAndAdvance)
}

async function stopAndAdvance() {
  phase.value = 'saving'
  rec.stop()
  // wait for the blob to assemble
  await new Promise(r => setTimeout(r, 300))
  const q = current.value
  if (q && rec.blob.value) {
    try {
      const audioUrl = await upload(rec.blob.value, 'recording')
      emit('audio', q.id, audioUrl)
    } catch (e) {
      toast.add({ title: 'Yuklash xatosi', description: (e as Error).message, color: 'error' })
    }
  }
  index.value += 1
  runQuestion()
}

// Manual skip of prep -> start speaking now
function skipPrep() {
  if (phase.value !== 'prep') return
  if (ticker) clearInterval(ticker)
  startSpeaking()
}
// Manual finish speaking early
function finishEarly() {
  if (phase.value !== 'speaking') return
  if (ticker) clearInterval(ticker)
  stopAndAdvance()
}

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
})

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <!-- Progress dots -->
    <div
      v-if="phase !== 'idle'"
      class="flex items-center justify-center gap-2 mb-4"
    >
      <span
        v-for="(q, i) in items"
        :key="q.id"
        class="size-2.5 rounded-full transition-colors"
        :class="i < index || phase === 'done' ? 'bg-primary' : i === index ? 'bg-primary/50' : 'bg-muted'"
      />
    </div>

    <!-- Idle: start -->
    <div
      v-if="phase === 'idle'"
      class="bg-default rounded-xl border border-default p-8 space-y-4 text-center"
    >
      <UIcon
        name="i-lucide-mic"
        class="size-12 text-primary mx-auto"
      />
      <h2 class="text-lg font-bold">
        Speaking Test
      </h2>
      <p class="text-sm text-muted">
        {{ items.length }} ta savol. Har bir savol uchun avval tayyorgarlik vaqti, so'ng gapirish vaqti beriladi. Gapirish vaqti tugagach javob avtomatik saqlanadi va keyingi savolga o'tiladi.
      </p>
      <UButton
        size="lg"
        color="primary"
        label="Boshlash"
        icon="i-lucide-play"
        :disabled="!items.length"
        @click="begin"
      />
    </div>

    <!-- Active question: prompt + image + countdown -->
    <div
      v-else-if="phase !== 'done'"
      class="bg-default rounded-xl border border-default p-6 space-y-5 text-center"
    >
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">
        Savol {{ index + 1 }} / {{ items.length }}
        <template v-if="current?.meta?.taskLabel">
          · Part {{ current.meta.taskLabel }}
        </template>
      </p>

      <img
        v-if="current?.meta?.imageUrl"
        :src="current.meta.imageUrl as string"
        alt="prompt"
        class="max-h-64 rounded-lg border border-default mx-auto"
      >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-if="current?.prompt"
        class="prose prose-sm dark:prose-invert max-w-none mx-auto"
        v-html="current.prompt"
      />

      <!-- Countdown ring -->
      <div class="relative size-32 mx-auto">
        <svg
          class="size-32 -rotate-90"
          viewBox="0 0 120 120"
        >
          <circle
            cx="60"
            cy="60"
            :r="RADIUS"
            fill="none"
            stroke="currentColor"
            stroke-width="8"
            class="text-muted/20"
          />
          <circle
            cx="60"
            cy="60"
            :r="RADIUS"
            fill="none"
            stroke="currentColor"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="dash"
            class="transition-all duration-1000 ease-linear"
            :class="phase === 'speaking' ? 'text-error' : 'text-primary'"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span
            class="font-mono text-2xl font-bold"
            :class="phase === 'speaking' ? 'text-error' : 'text-primary'"
          >
            {{ fmt(remaining) }}
          </span>
          <span class="text-[10px] uppercase tracking-wide text-muted">
            {{ phase === 'prep' ? 'Tayyorgarlik' : phase === 'speaking' ? 'Gapiring' : '' }}
          </span>
        </div>
      </div>

      <UBadge
        :color="phase === 'speaking' ? 'error' : phase === 'saving' ? 'neutral' : 'primary'"
        variant="subtle"
        :label="phase === 'prep' ? 'Tayyorlaning…' : phase === 'speaking' ? '● Yozilmoqda' : 'Saqlanmoqda…'"
      />

      <div class="flex justify-center gap-3">
        <UButton
          v-if="phase === 'prep'"
          color="primary"
          label="Hozir boshlash"
          icon="i-lucide-mic"
          @click="skipPrep"
        />
        <UButton
          v-else-if="phase === 'speaking'"
          color="error"
          label="Tugatish"
          icon="i-lucide-square"
          @click="finishEarly"
        />
      </div>
    </div>

    <!-- Done: review all responses + save -->
    <div
      v-else
      class="space-y-4"
    >
      <div class="bg-default rounded-xl border border-default p-6 text-center space-y-2">
        <UIcon
          name="i-lucide-check-circle"
          class="size-12 text-success mx-auto"
        />
        <h2 class="text-lg font-bold">
          Barcha savollar yakunlandi
        </h2>
        <p class="text-sm text-muted">
          Javoblaringizni tinglab ko'ring, so'ng urinishingizni saqlang.
        </p>
      </div>

      <div class="bg-default rounded-xl border border-default divide-y divide-default">
        <div
          v-for="(q, i) in items"
          :key="q.id"
          class="p-4 space-y-2"
        >
          <div class="flex items-center gap-2">
            <span class="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {{ i + 1 }}
            </span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span
              v-if="q.prompt"
              class="text-sm font-medium truncate"
              v-html="q.prompt"
            />
            <span
              v-else
              class="text-sm text-muted"
            >Savol {{ i + 1 }}</span>
          </div>
          <audio
            v-if="getAudio(q.id)"
            :src="getAudio(q.id) as string"
            controls
            class="h-9 w-full"
          />
          <p
            v-else
            class="text-xs text-error italic"
          >
            Javob yozilmadi
          </p>
        </div>
      </div>

      <UButton
        block
        size="lg"
        color="primary"
        :loading="submitting"
        label="Urinishni saqlash"
        icon="i-lucide-save"
        @click="emit('save')"
      />
    </div>
  </div>
</template>
