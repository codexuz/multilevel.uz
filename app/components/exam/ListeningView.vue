<script setup lang="ts">
import type { StudentQuestionDto, PartDto } from '~/types/models'

const props = defineProps<{
  parts: PartDto[]
  questions: StudentQuestionDto[]
  sectionAudio: string | null
  getResponse: (id: string) => string | string[] | null | undefined
  getAudio: (id: string) => string | null | undefined
  isAnswered: (q: StudentQuestionDto) => boolean
}>()
const emit = defineEmits<{
  response: [id: string, v: string | string[] | null]
  audio: [id: string, v: string | null]
}>()

const current = ref(0)
const currentQuestionId = ref<string | null>(null)
const started = ref(false)
const playing = ref(false)
const sectionAudioEl = ref<HTMLAudioElement | null>(null)

const part = computed(() => props.parts[current.value])
const hasAudio = computed(() => !!props.sectionAudio || props.parts.some(p => p.audioUrl))

function questionsFor(partId: string) {
  return props.questions
    .filter(q => q.partId === partId)
    .sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0))
}
const partQuestions = computed(() => (part.value ? questionsFor(part.value.id) : []))

// Grouped gap-fill (summary/note/table completion) for the active part.
const groups = computed(() => part.value?.content?.groups ?? [])
const groupedNumbers = computed(() => {
  const set = new Set<number>()
  for (const g of groups.value) {
    const text = g.template ?? (g.rows?.flat().join(' ') ?? '')
    for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) set.add(Number(m[1]))
  }
  return set
})
const ungroupedQuestions = computed(() =>
  partQuestions.value.filter(q => q.questionNumber == null || !groupedNumbers.value.has(q.questionNumber))
)

const flatQuestions = computed(() =>
  props.parts.flatMap((p, partIndex) => questionsFor(p.id).map(q => ({ q, partIndex })))
)

function start() {
  started.value = true
  nextTick(() => {
    sectionAudioEl.value?.play().catch(() => {})
  })
}

function scrollToQuestion(id: string) {
  nextTick(() => {
    document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function goToPart(index: number) {
  if (index < 0 || index >= props.parts.length) return
  current.value = index
  currentQuestionId.value = null
}

function onQuestionClick(q: StudentQuestionDto) {
  currentQuestionId.value = q.id
  scrollToQuestion(q.id)
}

function step(delta: number) {
  const flat = flatQuestions.value
  if (!flat.length) return
  const idx = currentQuestionId.value
    ? flat.findIndex(e => e.q.id === currentQuestionId.value)
    : (delta > 0 ? -1 : flat.length)
  const nextIdx = idx + delta
  const entry = flat[nextIdx]
  if (!entry) return
  if (entry.partIndex !== current.value) current.value = entry.partIndex
  currentQuestionId.value = entry.q.id
  scrollToQuestion(entry.q.id)
}
</script>

<template>
  <div class="h-full flex flex-col relative">
    <ExamAudioOverlay
      v-if="!started && hasAudio"
      @play="start"
    />

    <!-- Part header + audio -->
    <div class="shrink-0 px-4 py-2.5 bg-default border-b border-default space-y-2">
      <div class="flex items-center gap-2">
        <p class="text-sm font-bold text-highlighted">
          Part {{ current + 1 }}
        </p>
        <UBadge
          v-if="playing"
          color="error"
          variant="subtle"
          size="sm"
          label="● Audio ijro etilmoqda"
          :ui="{ base: 'rounded-full' }"
        />
      </div>
      <p
        v-if="part?.instructions"
        class="text-sm text-muted whitespace-pre-line"
      >
        {{ part.instructions }}
      </p>

      <!-- Section-level audio (single track across all parts) -->
      <audio
        v-if="sectionAudio"
        ref="sectionAudioEl"
        :src="sectionAudio"
        controls
        class="w-full h-9"
        @play="playing = true"
        @pause="playing = false"
        @ended="playing = false"
      />
      <!-- Per-part audio -->
      <audio
        v-else-if="part?.audioUrl"
        :key="part.id"
        :src="part.audioUrl"
        controls
        autoplay
        class="w-full h-9"
        @play="playing = true"
        @pause="playing = false"
        @ended="playing = false"
      />
    </div>

    <!-- Centered single-part question panel -->
    <div class="flex-1 min-h-0 overflow-auto flex justify-center py-6">
      <div class="w-full max-w-3xl px-4 space-y-5">
        <h2
          v-if="part?.title"
          class="text-base font-bold text-primary"
        >
          {{ part.title }}
        </h2>
        <!-- Grouped completions (shared paragraph/table with inline blanks) -->
        <ExamCompletionGroup
          v-for="(group, gi) in groups"
          :key="`group-${gi}`"
          :group="group"
          :questions="partQuestions"
          :get-response="getResponse"
          :current-question-id="currentQuestionId"
          @response="(id, v) => emit('response', id, v)"
        />

        <!-- Standalone questions -->
        <div
          v-for="q in ungroupedQuestions"
          :id="`q-${q.id}`"
          :key="q.id"
          class="scroll-mt-4 rounded-lg transition-colors"
          :class="q.id === currentQuestionId ? 'ring-2 ring-primary/40 -m-2 p-2' : ''"
        >
          <QuestionRenderer
            :question="q"
            :response="getResponse(q.id)"
            :audio-url="getAudio(q.id)"
            @update:response="emit('response', q.id, $event)"
            @update:audio-url="emit('audio', q.id, $event)"
          />
        </div>
      </div>
    </div>

    <!-- Bottom part navigation -->
    <ExamPartNav
      :parts="parts"
      :questions="questions"
      :current-part-index="current"
      :current-question-id="currentQuestionId"
      :is-answered="isAnswered"
      @part-change="goToPart"
      @question-click="onQuestionClick"
      @prev="step(-1)"
      @next="step(1)"
    />
  </div>
</template>
