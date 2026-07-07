<script setup lang="ts">
import type { StudentQuestionDto, PartDto } from '~/types/models'

const props = defineProps<{
  parts: PartDto[]
  questions: StudentQuestionDto[]
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

const part = computed(() => props.parts[current.value])
const passage = computed(() => (part.value?.content as { passage?: string })?.passage)

function questionsFor(partId: string) {
  return props.questions
    .filter(q => q.partId === partId)
    .sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0))
}
const partQuestions = computed(() => (part.value ? questionsFor(part.value.id) : []))

// Question-number range for the active part, e.g. "Questions 1–13".
const questionRange = computed(() => {
  const nums = partQuestions.value
    .map(q => q.questionNumber)
    .filter((n): n is number => n != null)
  if (!nums.length) return null
  return nums.length === 1 ? `Question ${nums[0]}` : `Questions ${nums[0]}–${nums[nums.length - 1]}`
})

// Flat, part-aware ordering used by prev/next.
const flatQuestions = computed(() =>
  props.parts.flatMap((p, partIndex) => questionsFor(p.id).map(q => ({ q, partIndex })))
)

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
  <div class="h-full flex flex-col">
    <!-- Part header -->
    <div class="shrink-0 px-4 py-2.5 bg-default border-b border-default">
      <p class="text-sm font-bold text-highlighted">
        Part {{ current + 1 }}
      </p>
      <p class="text-sm text-muted">
        {{ part?.instructions || (questionRange ? `Read the text and answer ${questionRange.toLowerCase()}.` : 'Read the text and answer the questions.') }}
      </p>
    </div>

    <ResizableSplit
      class="flex-1 min-h-0 bg-default overflow-hidden"
      :initial="50"
      :min="25"
      storage-key="reading-split"
    >
      <template #left>
        <div class="h-full overflow-auto p-5">
          <h2 class="text-base font-bold text-primary mb-2">
            {{ part?.title }}
          </h2>
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="passage"
            class="prose prose-sm dark:prose-invert max-w-none"
            v-html="passage"
          />
          <!-- eslint-enable vue/no-v-html -->
          <p
            v-else
            class="text-sm text-muted"
          >
            No passage for this part.
          </p>
        </div>
      </template>

      <template #right>
        <div class="h-full overflow-auto p-5 space-y-5 border-t lg:border-t-0 lg:border-l border-default">
          <div
            v-for="q in partQuestions"
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
      </template>
    </ResizableSplit>

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
