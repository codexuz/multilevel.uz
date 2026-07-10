<script setup lang="ts">
import type { QuestionDto } from '~/types/models'
import type { ReviewData } from '~/types/review'
import { highlightPassage } from '~/utils/passage-highlight'

definePageMeta({ layout: 'exam' })

const route = useRoute()
const attemptId = route.params.attemptId as string

const { data, error } = await useFetch<ReviewData>(`/api/attempts/${attemptId}/review`)

const showAnswers = ref(true)
const current = ref(0)
const currentQuestionId = ref<string | null>(null)

const parts = computed(() => data.value?.parts ?? [])
const questions = computed(() => data.value?.questions ?? [])
const isReading = computed(() => data.value?.section.type === 'reading')

const answerMap = computed(() => new Map((data.value?.answers ?? []).map(a => [a.questionId, a])))
function getAnswer(questionId: string) {
  return answerMap.value.get(questionId)
}

const part = computed(() => parts.value[current.value])
const passage = computed(() => (part.value?.content as { passage?: string })?.passage)

function questionsFor(partId: string) {
  return questions.value
    .filter(q => q.partId === partId)
    .sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0))
}
const partQuestions = computed(() => (part.value ? questionsFor(part.value.id) : []))

// Grouped gap-fill blanks are rendered inside their group shell, so they drop
// out of the standalone question list — same split as the exam runner.
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

// Reading: mark the sentences the answers came from, right in the passage.
const markedPassage = computed(() => {
  if (!passage.value) return ''
  if (!isReading.value || !showAnswers.value) return passage.value
  const evidence = partQuestions.value
    .filter(q => q.questionNumber != null && q.meta.fromText)
    .map(q => ({ questionNumber: q.questionNumber!, text: q.meta.fromText! }))
  return highlightPassage(passage.value, evidence)
})

const partScore = computed(() => {
  const qs = partQuestions.value
  const correct = qs.filter(q => getAnswer(q.id)?.isCorrect).length
  return { correct, total: qs.length }
})

const flatQuestions = computed(() =>
  parts.value.flatMap((p, partIndex) => questionsFor(p.id).map(q => ({ q, partIndex })))
)

function scrollToQuestion(id: string) {
  nextTick(() => {
    document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
function goToPart(index: number) {
  if (index < 0 || index >= parts.value.length) return
  current.value = index
  currentQuestionId.value = null
}
function onQuestionClick(q: QuestionDto) {
  currentQuestionId.value = q.id
  scrollToQuestion(q.id)
}
function step(delta: number) {
  const flat = flatQuestions.value
  if (!flat.length) return
  const idx = currentQuestionId.value
    ? flat.findIndex(e => e.q.id === currentQuestionId.value)
    : (delta > 0 ? -1 : flat.length)
  const entry = flat[idx + delta]
  if (!entry) return
  if (entry.partIndex !== current.value) current.value = entry.partIndex
  currentQuestionId.value = entry.q.id
  scrollToQuestion(entry.q.id)
}
</script>

<template>
  <div
    v-if="error"
    class="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <UIcon
      name="i-lucide-file-question"
      class="size-10 text-muted"
    />
    <p class="text-muted">
      {{ error.statusCode === 409
        ? 'This attempt has not been graded yet.'
        : error.statusCode === 400
          ? 'Answer review is only available for listening and reading sections.'
          : 'This review could not be loaded.' }}
    </p>
    <UButton
      :to="`/results/${attemptId}`"
      label="Back to results"
      color="neutral"
      variant="subtle"
    />
  </div>

  <div
    v-else-if="data"
    class="h-screen flex flex-col bg-default"
  >
    <ReviewHeader
      v-model:show-answers="showAnswers"
      :test-title="data.testTitle"
      :section="data.section"
      :attempt="data.attempt"
    />

    <!-- Part header -->
    <div class="shrink-0 px-4 py-2.5 bg-default border-b border-default space-y-2">
      <div class="flex items-center gap-2">
        <p class="text-sm font-bold text-highlighted">
          Part {{ current + 1 }}
        </p>
        <UBadge
          :label="`${partScore.correct} of ${partScore.total} correct`"
          color="neutral"
          variant="subtle"
          size="sm"
        />
      </div>
      <p
        v-if="part?.instructions"
        class="text-sm text-muted whitespace-pre-line"
      >
        {{ part.instructions }}
      </p>

      <!-- Re-listen while reviewing -->
      <audio
        v-if="!isReading && (part?.audioUrl || data.section.audioUrl)"
        :key="part?.audioUrl ?? 'section'"
        :src="part?.audioUrl ?? data.section.audioUrl!"
        controls
        class="w-full h-9"
      />
    </div>

    <!-- Reading: passage beside the questions -->
    <ResizableSplit
      v-if="isReading && passage"
      class="flex-1 min-h-0 overflow-hidden"
      :initial="50"
      :min="25"
      storage-key="review-split"
    >
      <template #left>
        <div class="h-full overflow-auto p-5">
          <h2 class="text-base font-bold text-primary mb-2">
            {{ part?.title }}
          </h2>
          <img
            v-if="part?.imageUrl"
            :src="part.imageUrl"
            :alt="part.title"
            class="mb-3 max-w-full rounded-md border border-default"
          >
          <!-- eslint-disable vue/no-v-html -->
          <div
            class="review-passage prose prose-sm dark:prose-invert max-w-none"
            v-html="markedPassage"
          />
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </template>

      <template #right>
        <div class="h-full overflow-auto p-5 border-t lg:border-t-0 lg:border-l border-default">
          <ReviewQuestionList
            :groups="groups"
            :part-questions="partQuestions"
            :ungrouped-questions="ungroupedQuestions"
            :current-question-id="currentQuestionId"
            :show-answers="showAnswers"
            :get-answer="getAnswer"
            hide-evidence
          />
        </div>
      </template>
    </ResizableSplit>

    <!-- Listening (and passage-less reading): single centered column -->
    <div
      v-else
      class="flex-1 min-h-0 overflow-auto"
    >
      <div class="w-full max-w-3xl mx-auto px-4 pt-6 pb-28">
        <h2
          v-if="part?.title"
          class="text-base font-bold text-primary mb-4"
        >
          {{ part.title }}
        </h2>
        <img
          v-if="part?.imageUrl"
          :src="part.imageUrl"
          :alt="part.title"
          class="mb-4 max-w-full rounded-md border border-default"
        >
        <ReviewQuestionList
          :groups="groups"
          :part-questions="partQuestions"
          :ungrouped-questions="ungroupedQuestions"
          :current-question-id="currentQuestionId"
          :show-answers="showAnswers"
          :get-answer="getAnswer"
        />
      </div>
    </div>

    <ReviewPartNav
      :parts="parts"
      :questions="questions"
      :current-part-index="current"
      :current-question-id="currentQuestionId"
      :get-answer="getAnswer"
      @part-change="goToPart"
      @question-click="onQuestionClick"
      @prev="step(-1)"
      @next="step(1)"
    />
  </div>
</template>

<style>
/* Evidence spans injected by highlightPassage(). */
.review-passage mark.evidence {
  background-color: var(--ui-warning);
  background-color: color-mix(in oklch, var(--ui-warning) 22%, transparent);
  color: inherit;
  border-radius: 2px;
  padding: 1px 2px;
}
.review-passage .evidence-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 3px;
  border-radius: 9999px;
  background-color: var(--ui-warning);
  color: var(--ui-bg);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
}
</style>
